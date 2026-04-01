import asyncio
import httpx
import os
import json
import time
from datetime import datetime, timezone, timedelta
import pandas as pd
from sqlalchemy import create_engine, MetaData, Table, text
from sqlalchemy.dialects.postgresql import insert

import logging
from logging.handlers import RotatingFileHandler
import os

os.makedirs('logs', exist_ok=True)
logger = logging.getLogger('scraper_update')
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = RotatingFileHandler('logs/scraper_update.log', maxBytes=5*1024*1024, backupCount=3)
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    console = logging.StreamHandler()
    console.setFormatter(formatter)
    logger.addHandler(console)


DATABASE_URL = "postgresql:///mlb_db"
engine = create_engine(DATABASE_URL)
metadata = MetaData()
metadata.reflect(bind=engine)

async def fetch_data(client, url, max_retries=3):
    """Fetch data with retries using httpx AsyncClient."""
    for attempt in range(max_retries):
        try:
            resp = await client.get(url, timeout=30.0)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPError as e:
            if attempt == max_retries - 1:
                logger.error(f"Failed to fetch {url} after {max_retries} attempts: {e}")
                return None
            await asyncio.sleep(2 ** attempt)
        except Exception as e:
            logger.info(f"Unexpected error fetching {url}: {e}")
            return None
    return None

def execute_upsert(df, table_name, pk_cols):
    """Perform a Postgres bulk UPSERT (ON CONFLICT DO UPDATE) from a DataFrame."""
    if df.empty:
        return
    
    table = metadata.tables[table_name]
    records = df.to_dict(orient='records')
    
    # Clean NaNs
    for r in records:
        for k, v in r.items():
            if pd.isna(v):
                r[k] = None
    
    stmt = insert(table).values(records)
    
    # Update columns
    update_dict = {
        col.name: stmt.excluded[col.name]
        for col in table.columns
        if col.name not in pk_cols
    }
    
    # If there's nothing to update (e.g. mapping table), DO NOTHING
    if not update_dict:
        stmt = stmt.on_conflict_do_nothing(index_elements=pk_cols)
    else:
        stmt = stmt.on_conflict_do_update(
            index_elements=pk_cols,
            set_=update_dict
        )
        
    with engine.begin() as conn:
        conn.execute(stmt)

async def update_season_and_teams(client):
    logger.info("--- Updating Season & Teams ---")
    current_year = datetime.now(timezone.utc).year
    url = f"https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/{current_year}?lang=en&region=us"
    season_data = await fetch_data(client, url)
    if not season_data:
        raise Exception("Failed to fetch core season data.")
    
    season_records = [{
        'season_year': current_year,
        'start_date': season_data['startDate'][:10],
        'end_date': season_data['endDate'][:10],
        'display_name': season_data['displayName']
    }]
    execute_upsert(pd.DataFrame(season_records), 'seasons', ['season_year'])
    
    types_url = season_data['types']['$ref'].replace("http://", "https://")
    types_data = await fetch_data(client, types_url)
    season_types = []
    if types_data and 'items' in types_data:
        type_tasks = [fetch_data(client, t['$ref'].replace("http://", "https://")) for t in types_data['items']]
        type_results = await asyncio.gather(*type_tasks)
        for t_detail in type_results:
            if t_detail:
                type_id = int(t_detail['id'])
                season_types.append({
                    'season_type_id': f"{current_year}_{type_id}",
                    'season_year': current_year,
                    'type_id': type_id,
                    'name': t_detail['name'],
                    'abbreviation': t_detail['abbreviation'],
                    'start_date': t_detail['startDate'][:10],
                    'end_date': t_detail['endDate'][:10]
                })
    if season_types:
        execute_upsert(pd.DataFrame(season_types), 'season_types', ['season_type_id'])
    
    teams_url = f"https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/{current_year}/teams?lang=en&region=us&limit=150"
    teams_data = await fetch_data(client, teams_url)
    teams_records = []
    
    if teams_data and 'items' in teams_data:
        team_tasks = [fetch_data(client, team_ref['$ref'].replace("http://", "https://")) for team_ref in teams_data['items']]
        team_results = await asyncio.gather(*team_tasks)
        
        for team_info in team_results:
            if not team_info: continue
            
            team_id = int(team_info['id'])
            teams_records.append({
                'season_team_id': f"{current_year}_{team_id}",
                'season_year': current_year,
                'team_id': team_id,
                'uid': team_info.get('uid'),
                'location': team_info.get('location'),
                'name': team_info.get('name'),
                'abbreviation': team_info.get('abbreviation'),
                'display_name': team_info.get('displayName'),
                'color': team_info.get('color'),
                'alternate_color': team_info.get('alternateColor'),
                'is_active': team_info.get('isActive')
            })
            
    df_teams = pd.DataFrame(teams_records)
    if not df_teams.empty:
        execute_upsert(df_teams, 'season_teams', ['season_team_id'])
        logger.info(f"✓ Saved {len(df_teams)} teams for {current_year}.")
    
    return df_teams

async def update_rosters_and_athletes(client, df_teams):
    if df_teams.empty: return
    
    # Pre-fetch existing athletes to avoid hitting ESPN 2000 times
    with engine.connect() as conn:
        try:
            existing_df = pd.read_sql("SELECT athlete_id FROM athletes", conn)
            existing_ids = set(existing_df['athlete_id'].tolist())
        except:
            existing_ids = set()

    logger.info("--- Updating 40-Man Rosters & Athletes ---")
    current_year = datetime.now(timezone.utc).year
    
    athletes_data = []
    roster_records = []
    
    async def process_team_roster(team_id):
        url = f"https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/{current_year}/teams/{team_id}/athletes?lang=en&region=us&limit=150"
        data = await fetch_data(client, url)
        if not data or 'items' not in data: return
        
        for item in data.get('items', []):
            a_ref = item['$ref'].replace("http://", "https://")
            a_id = int(a_ref.split('/athletes/')[1].split('?')[0])
            
            roster_records.append({
                'roster_id': f"{current_year}_{team_id}_{a_id}",
                'season_team_id': f"{current_year}_{team_id}",
                'season_year': current_year,
                'team_id': team_id,
                'athlete_id': a_id
            })
            
            if a_id not in existing_ids:
                a_data = await fetch_data(client, a_ref)
                if a_data:
                    athletes_data.append({
                    'athlete_id': int(a_data.get('id')),
                    'uid': a_data.get('uid'),
                    'first_name': a_data.get('firstName'),
                    'last_name': a_data.get('lastName'),
                    'full_name': a_data.get('fullName'),
                    'display_name': a_data.get('displayName'),
                    'weight': a_data.get('weight'),
                    'height': a_data.get('height'),
                    'age': a_data.get('age'),
                    'date_of_birth': a_data.get('dateOfBirth', '')[:10] if a_data.get('dateOfBirth') else None,
                    'birth_city': a_data.get('birthPlace', {}).get('city'),
                    'birth_state': a_data.get('birthPlace', {}).get('state'),
                    'birth_country': a_data.get('birthPlace', {}).get('country'),
                    'bats': a_data.get('bats', {}).get('abbreviation'),
                    'throws': a_data.get('throws', {}).get('abbreviation'),
                    'is_active': a_data.get('active', False),
                    'position_id': int(a_data.get('position', {}).get('$ref', '').split('/positions/')[1].split('?')[0]) if 'position' in a_data else None
                    })

    tasks = [process_team_roster(row['team_id']) for _, row in df_teams.iterrows()]
    await asyncio.gather(*tasks)

    df_athletes = pd.DataFrame(athletes_data).drop_duplicates(subset=['athlete_id'])
    if not df_athletes.empty:
        execute_upsert(df_athletes, 'athletes', ['athlete_id'])
        logger.info(f"✓ Saved {len(df_athletes)} unique athletes.")
        
    df_rosters = pd.DataFrame(roster_records).drop_duplicates()
    if not df_rosters.empty:
        # Wipe the entire season_rosters table for this year, then append (to match exact live state and trades)
        with engine.begin() as conn:
            conn.execute(text(f"DELETE FROM season_rosters WHERE season_year = {current_year}"))
        
        df_rosters.to_sql('season_rosters', engine, if_exists='append', index=False)
        logger.info(f"✓ Replaced {len(df_rosters)} roster spots to reflect live state.")

def safe_int(val):
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None

async def update_game_data(client):
    logger.info("--- Updating Game Data (Last 48 Hours) ---")
    today_str = datetime.now(timezone.utc).strftime('%Y%m%d')
    yesterday_str = (datetime.now(timezone.utc) - timedelta(days=1)).strftime('%Y%m%d')
    
    event_refs = []
    for date_str in [yesterday_str, today_str]:
        url = f"https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/events?dates={date_str}&limit=500"
        resp = await fetch_data(client, url)
        if resp and 'items' in resp:
            event_refs.extend([item['$ref'] for item in resp['items']])
            
    event_refs = list(set(event_refs))
    if not event_refs:
        logger.info("No games scheduled for today or yesterday. Skipping game update.")
        return

    logger.info(f"Found {len(event_refs)} scheduled games. Fetching summaries...")
    
    summary_urls = [f"https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event={url.split('/events/')[1].split('?')[0]}&region=us&lang=en" for url in event_refs]
    
    global_events = []
    global_competitors = []
    global_batting = []
    global_pitching = []
    global_plays = []
    global_wp = []
    global_odds = []

    tasks = [fetch_data(client, url) for url in summary_urls]
    results = await asyncio.gather(*tasks)

    for data in results:
        if not data or 'header' not in data: continue
        
        event_id = int(data['header']['id'])
        season_year = int(data['header']['season']['year'])
        
        game_date = data['header']['competitions'][0]['date']
        dt_obj = datetime.fromisoformat(game_date.replace("Z", "+00:00"))
        date_only = dt_obj.strftime('%Y-%m-%d')
        
        status_name = data['header']['competitions'][0]['status']['type']['name']
        if status_name not in ['STATUS_FINAL', 'STATUS_POSTPONED', 'STATUS_CANCELED']:
            continue
            
        global_events.append({
            'event_id': event_id,
            'date': pd.to_datetime(game_date, utc=True).replace(tzinfo=None),
            'name': data.get('header', {}).get('name'),
            'short_name': data.get('header', {}).get('competitions', [{}])[0].get('shortName'),
            'season_year': season_year,
            'attendance': data.get('gameInfo', {}).get('attendance'),
            'venue_id': safe_int(data.get('gameInfo', {}).get('venue', {}).get('id'))
        })
        
        # Odds
        odds_list = data['header']['competitions'][0].get('odds', [])
        if odds_list:
            o = odds_list[0]
            away_ml = o.get('awayTeamOdds', {}).get('moneyLine')
            home_ml = o.get('homeTeamOdds', {}).get('moneyLine')
            ou = o.get('overUnder')
            over_odds = o.get('overOdds')
            under_odds = o.get('underOdds')
            if any([away_ml, home_ml, ou]):
                global_odds.append({
                    'event_odds_id': f"{event_id}_{o.get('provider', {}).get('id', 'unknown')}",
                    'event_id': event_id,
                    'provider_id': o.get('provider', {}).get('id'),
                    'provider_name': o.get('provider', {}).get('name'),
                    'away_moneyline': away_ml,
                    'home_moneyline': home_ml,
                    'over_under': ou,
                    'over_odds': over_odds,
                    'under_odds': under_odds,
                    'details': o.get('details')
                })

        for comp in data['header']['competitions'][0]['competitors']:
            team_id = int(comp['id'])
            
            # Extract player stats from boxscores first
            batters_dict = {}
            pitchers_dict = {}
            if 'boxscore' in data and 'players' in data['boxscore']:
                for team_box in data['boxscore']['players']:
                    if int(team_box['team']['id']) != team_id: continue
                    for stat_group in team_box.get('statistics', []):
                        labels = stat_group['labels']
                        if stat_group['type'] == 'batting':
                            for athlete in stat_group.get('athletes', []):
                                if not athlete.get('stats'): continue
                                stats_dict = dict(zip(labels, athlete['stats']))
                                detail_str = None
                                if athlete.get('notes'):
                                    import re
                                    txt = athlete['notes'][0].get('text', '')
                                    match = re.search(r'\((.*?)\)', txt)
                                    if match: detail_str = match.group(1)
                                
                                global_batting.append({
                                    'event_batting_id': f"{event_id}_{athlete['athlete']['id']}",
                                    'event_id': event_id,
                                    'team_id': team_id,
                                    'athlete_id': int(athlete['athlete']['id']),
                                    'starter': athlete.get('starter', False),
                                    'position_id': safe_int(athlete.get('position', {}).get('id')) if athlete.get('position') else None,
                                    'ab': safe_int(stats_dict.get('AB')),
                                    'r': safe_int(stats_dict.get('R')),
                                    'h': safe_int(stats_dict.get('H')),
                                    'rbi': safe_int(stats_dict.get('RBI')),
                                    'hr': safe_int(stats_dict.get('HR')),
                                    'bb': safe_int(stats_dict.get('BB')),
                                    'k': safe_int(stats_dict.get('K')),
                                    'pitches_faced': safe_int(stats_dict.get('#P')),
                                    'd': 0,
                                    't': 0,
                                    'sb': 0
                                })
                        elif stat_group['type'] == 'pitching':
                            for athlete in stat_group.get('athletes', []):
                                if not athlete.get('stats'): continue
                                stats_dict = dict(zip(labels, athlete['stats']))
                                global_pitching.append({
                                    'event_pitching_id': f"{event_id}_{athlete['athlete']['id']}",
                                    'event_id': event_id,
                                    'team_id': team_id,
                                    'athlete_id': int(athlete['athlete']['id']),
                                    'starter': athlete.get('starter', False),
                                    'recorded_win': False, # simplified for brevity
                                    'ip': stats_dict.get('IP', stats_dict.get('fullInnings.partInnings')),
                                    'h': safe_int(stats_dict.get('H')),
                                    'r': safe_int(stats_dict.get('R')),
                                    'er': safe_int(stats_dict.get('ER')),
                                    'bb': safe_int(stats_dict.get('BB')),
                                    'k': safe_int(stats_dict.get('K')),
                                    'hr': safe_int(stats_dict.get('HR')),
                                    'pitches': safe_int(stats_dict.get('#P', 0))
                                })
            
            global_competitors.append({
                'event_competitor_id': f"{event_id}_{team_id}",
                'event_id': event_id,
                'season_year': season_year,
                'team_id': team_id,
                
                'home_away': comp['homeAway'],
                'winner': comp.get('winner'),
                'score': safe_int(comp.get('score'))
            })
                            
        # Plays
        if 'plays' in data:
            for play in data['plays']:
                bat_team_id = None
                if 'team' in play and play['team']: bat_team_id = safe_int(play['team'].get('id'))
                elif play.get('participants'): bat_team_id = safe_int(play['participants'][0].get('athlete', {}).get('team', {}).get('id'))
                
                global_plays.append({
                    'play_id': play['id'],
                    'event_id': event_id,
                    'inning': safe_int(play.get('period', {}).get('number')),
                    'is_scoring_play': play.get('scoringPlay', False),
                    'score_value': safe_int(play.get('scoreValue')),
                    'away_score': safe_int(play.get('awayScore')),
                    'home_score': safe_int(play.get('homeScore')),
                    'play_type_id': safe_int(play.get('type', {}).get('id')),
                    'play_type_text': play.get('type', {}).get('text'),
                    'text': play.get('text'),
                    'pitch_type': play.get('pitchType', {}).get('text'),
                    'pitch_velocity': play.get('pitchVelocity'),
                    'pitch_coordinate_x': play.get('pitchCoordinate', {}).get('x'),
                    'pitch_coordinate_y': play.get('pitchCoordinate', {}).get('y'),
                    'hit_coordinate_x': play.get('hitCoordinate', {}).get('x'),
                    'hit_coordinate_y': play.get('hitCoordinate', {}).get('y')
                })
                
        # Win Prob
        if 'winprobability' in data:
            for wp in data['winprobability']:
                global_wp.append({
                    'play_id': wp.get('playId'),
                    'event_id': event_id,
                    'home_win_percentage': wp.get('homeWinPercentage'),
                    'tie_percentage': wp.get('tiePercentage')
                })

    # DB Inserts
    if global_events:
        df_events = pd.DataFrame(global_events).drop_duplicates(subset=['event_id'])
        execute_upsert(df_events, 'events', ['event_id'])
        logger.info(f"✓ Saved {len(df_events)} events.")
        
    if global_competitors:
        df_comp = pd.DataFrame(global_competitors).drop_duplicates()
        with engine.connect() as conn:
            t_df = pd.read_sql("SELECT season_team_id, team_id, season_year FROM season_teams", conn)
        df_comp = df_comp.merge(t_df, on=['team_id', 'season_year'], how='inner')
        df_comp = df_comp.drop(['team_id', 'season_year'], axis=1)
        execute_upsert(df_comp, 'event_competitors', ['event_competitor_id'])
        logger.info(f"✓ Saved {len(df_comp)} competitors.")
        
    if global_batting:
        df_b = pd.DataFrame(global_batting).drop_duplicates(subset=['event_id', 'athlete_id'])
        execute_upsert(df_b, 'event_boxscores_batting', ['event_batting_id'])
        logger.info(f"✓ Saved {len(df_b)} batting records.")
        
    if global_pitching:
        df_p = pd.DataFrame(global_pitching).drop_duplicates(subset=['event_id', 'athlete_id'])
        execute_upsert(df_p, 'event_boxscores_pitching', ['event_pitching_id'])
        logger.info(f"✓ Saved {len(df_p)} pitching records.")
        
    if global_plays:
        df_plays = pd.DataFrame(global_plays).drop_duplicates(subset=['play_id'])
        execute_upsert(df_plays, 'event_plays', ['play_id'])
        logger.info(f"✓ Saved {len(df_plays)} plays.")
        
    if global_wp:
        df_wp = pd.DataFrame(global_wp).drop_duplicates(subset=['play_id'])
        execute_upsert(df_wp, 'event_win_probability', ['play_id'])
        logger.info(f"✓ Saved {len(df_wp)} win prob data points.")
        
    if global_odds:
        df_odds = pd.DataFrame(global_odds).drop_duplicates(subset=['event_odds_id'])
        execute_upsert(df_odds, 'event_odds', ['event_odds_id'])
        logger.info(f"✓ Saved {len(df_odds)} odds records.")

async def main():
    t0 = time.time()
    try:
        async with httpx.AsyncClient(limits=httpx.Limits(max_connections=50, max_keepalive_connections=20)) as client:
            df_current_teams = await update_season_and_teams(client)
            await update_rosters_and_athletes(client, df_current_teams)
            await update_game_data(client)
    except Exception as e:
        logger.error(f"\nCRITICAL UPDATE FAILURE: {e}")
    logger.info(f"Cron Update Cycle Completed in {time.time() - t0:.2f} seconds.")

if __name__ == "__main__":
    asyncio.run(main())