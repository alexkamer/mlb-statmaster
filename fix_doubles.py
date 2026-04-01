import asyncio
import httpx
import re
from sqlalchemy import create_engine, text
from concurrent.futures import ThreadPoolExecutor

engine = create_engine('postgresql:///mlb_db')

def fetch_summary(client, event_id):
    url = f"https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event={event_id}"
    resp = client.get(url)
    if resp.status_code == 200:
        return resp.json()
    return None

def parse_detail_str(text_str):
    res = {}
    for p in text_str.split(';'):
        m = re.match(r'^\s*([A-Za-z\-\.\'\s\,]+?)\s*(?:(\d+)\s*)?\(', p)
        if m:
            name = m.group(1).strip()
            count = int(m.group(2)) if m.group(2) else 1
            res[name] = count
    return res

def process_event(event_id):
    with httpx.Client() as client:
        data = fetch_summary(client, event_id)
        if not data: return
        
        updates = []
        
        # 1. Build a map of athlete_id -> (d, t, sb) from plays first for accuracy
        stats = {}
        
        # Parse from Plays for doubles and triples (100% accurate)
        for play in data.get('plays', []):
            ptype = play.get('type', {}).get('text', '')
            if ptype in ['Double', 'Triple']:
                for p in play.get('participants', []):
                    if p.get('type') == 'batter':
                        aid = p.get('athlete', {}).get('id')
                        if aid:
                            aid = int(aid)
                            if aid not in stats: stats[aid] = {'d':0, 't':0, 'sb':0}
                            if ptype == 'Double': stats[aid]['d'] += 1
                            if ptype == 'Triple': stats[aid]['t'] += 1

            if ptype == 'Stolen Base' or 'stole' in play.get('text', '').lower():
                # Extract from text if possible, or just look at details
                pass

        # Parse from team.details for stolen bases (or doubles/triples if plays didn't catch them)
        name_to_id = {}
        for player in data.get('boxscore', {}).get('players', []):
            for stat in player.get('statistics', []):
                for ath in stat.get('athletes', []):
                    short = ath.get('athlete', {}).get('shortName', '')
                    last = short.split(' ')[-1] if ' ' in short else short
                    aid = int(ath.get('athlete', {}).get('id'))
                    name_to_id[last.lower()] = aid
                    name_to_id[short.lower()] = aid
                    name_to_id[ath.get('athlete', {}).get('displayName', '').lower()] = aid

        for team in data.get('boxscore', {}).get('teams', []):
            for detail in team.get('details', []):
                if detail.get('name') == 'battingDetails':
                    for stat in detail.get('stats', []):
                        if stat.get('name') in ['doubles', 'triples', 'stolenBases']:
                            parsed = parse_detail_str(stat.get('displayValue', ''))
                            for name, count in parsed.items():
                                # match name to id
                                matched_id = None
                                for k, v in name_to_id.items():
                                    if name.lower() in k or k in name.lower():
                                        matched_id = v
                                        break
                                if matched_id:
                                    if matched_id not in stats: stats[matched_id] = {'d':0, 't':0, 'sb':0}
                                    if stat.get('name') == 'doubles': stats[matched_id]['d'] = max(stats[matched_id]['d'], count)
                                    if stat.get('name') == 'triples': stats[matched_id]['t'] = max(stats[matched_id]['t'], count)
                                    if stat.get('name') == 'stolenBases': stats[matched_id]['sb'] = max(stats[matched_id]['sb'], count)

        with engine.begin() as conn:
            for aid, s in stats.items():
                conn.execute(text(
                    "UPDATE event_boxscores_batting SET d = :d, t = :t, sb = :sb WHERE event_id = :eid AND athlete_id = :aid"
                ), {"d": s['d'], "t": s['t'], "sb": s['sb'], "eid": event_id, "aid": aid})

def main():
    with engine.connect() as conn:
        events = [r[0] for r in conn.execute(text("SELECT event_id FROM events WHERE season_year = 2026")).fetchall()]
    
    print(f"Fixing {len(events)} events...")
    with ThreadPoolExecutor(max_workers=20) as executor:
        list(executor.map(process_event, events))
    print("Done!")

if __name__ == '__main__':
    main()
