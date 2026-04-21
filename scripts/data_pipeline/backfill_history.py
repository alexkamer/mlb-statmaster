import asyncio
import httpx
import os
import time
from datetime import datetime, timezone, timedelta
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.dialects.postgresql import insert
import logging
from logging.handlers import RotatingFileHandler
import re

os.makedirs('logs', exist_ok=True)
logger = logging.getLogger('backfill_history')
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = RotatingFileHandler('logs/backfill_history.log', maxBytes=10*1024*1024, backupCount=5)
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    
    console = logging.StreamHandler()
    console.setFormatter(formatter)
    logger.addHandler(console)

DATABASE_URL = "postgresql:///mlb_db"
engine = create_engine(DATABASE_URL)

def safe_int(val):
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None

async def fetch_with_backoff(client, url, semaphore, max_retries=10):
    """Fetch from ESPN with exponential backoff on 429/403 errors."""
    async with semaphore:
        for attempt in range(max_retries):
            try:
                # Add a tiny 0.1s jitter to avoid bursting the API at the exact same millisecond
                await asyncio.sleep(0.1) 
                
                resp = await client.get(url, timeout=15.0)
                
                if resp.status_code == 200:
                    return resp.json()
                elif resp.status_code in [429, 403, 502, 503, 504]:
                    sleep_time = (2 ** attempt) + 1  # 2, 3, 5, 9, 17... seconds
                    logger.warning(f"Rate limited (HTTP {resp.status_code}) on {url}. Retrying in {sleep_time}s...")
                    await asyncio.sleep(sleep_time)
                elif resp.status_code == 404:
                    return None
                else:
                    logger.error(f"HTTP {resp.status_code} on {url}")
                    return None
            except Exception as e:
                sleep_time = (2 ** attempt) + 1
                logger.warning(f"Exception on {url}: {e}. Retrying in {sleep_time}s...")
                await asyncio.sleep(sleep_time)
                
        logger.error(f"Failed to fetch {url} after {max_retries} retries.")
        return None

async def scrape_day(client, target_date, semaphore, existing_events, all_athlete_ids, session_teams_df):
    date_str = target_date.strftime("%Y%m%d")
    scoreboard_url = f"https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates={date_str}"
    
    scoreboard_data = await fetch_with_backoff(client, scoreboard_url, semaphore)
    if not scoreboard_data or 'events' not in scoreboard_data:
        return 0, 0
        
    events = scoreboard_data['events']
    
    # Collect missing events
    missing_event_ids = []
    for ev in events:
        eid = int(ev['id'])
        if eid not in existing_events:
            missing_event_ids.append(eid)
            
    if not missing_event_ids:
        logger.info(f"[{date_str}] All {len(events)} events already in DB. Skipping.")
        return len(events), 0

    logger.info(f"[{date_str}] Found {len(events)} total games. {len(missing_event_ids)} missing. Fetching summaries...")
    
    summary_urls = [
        (eid, f"https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event={eid}")
        for eid in missing_event_ids
    ]
    
    tasks = [fetch_with_backoff(client, url, semaphore) for _, url in summary_urls]
    results = await asyncio.gather(*tasks)
    
    global_events = []
    global_competitors = []
    global_batting = []
    global_pitching = []
    global_plays = []
    global_wp = []
    new_athlete_records = []
    
    for (eid, _), data in zip(summary_urls, results):
        if not data or 'header' not in data:
            continue
            
        try:
            # --- 1. EVENTS ---
            season_year = safe_int(data.get('header', {}).get('season', {}).get('year'))
            if not season_year:
                continue
                
            try:
                competitions = data.get('header', {}).get('competitions', [{}])
                if not competitions:
                    continue
                game_date = competitions[0].get('date')
                status_name = competitions[0].get('status', {}).get('type', {}).get('name')
            except Exception:
                continue
                
            if not game_date or status_name not in ['STATUS_FINAL', 'STATUS_POSTPONED', 'STATUS_CANCELED']:
                # If a historical game somehow isn't final or canceled, skip it
                continue
                
            # Construct a fallback name if 'name' is missing from the header (happens in older ESPN game endpoints)
            name = data.get('header', {}).get('name')
            if not name:
                competitors = data.get('header', {}).get('competitions', [{}])[0].get('competitors', [])
                if len(competitors) == 2:
                    away = competitors[1].get('team', {}).get('displayName', 'Away')
                    home = competitors[0].get('team', {}).get('displayName', 'Home')
                    name = f"{away} at {home}"
                else:
                    name = "Unknown Matchup"
                    
            global_events.append({
                'event_id': eid,
                'date': game_date,
                'name': name,
                'season_year': season_year
            })
            
            # --- 2. EVENT COMPETITORS ---
            for team in data.get('header', {}).get('competitions', [{}])[0].get('competitors', []):
                team_id = safe_int(team.get('id'))
                if not team_id: continue
                global_competitors.append({
                    'event_competitor_id': f"{eid}_{team_id}",
                    'event_id': eid,
                    'team_id': team_id,
                    'home_away': team.get('homeAway'),
                    'winner': team.get('winner', False),
                    'score': safe_int(team.get('score'))
                })
                
            # --- 3. BOXSCORES ---
            if 'boxscore' in data and 'players' in data['boxscore']:
                for team_box in data['boxscore']['players']:
                    team_id = safe_int(team_box.get('team', {}).get('id'))
                    if not team_id: continue
                    
                    for stat_group in team_box.get('statistics', []):
                        labels = stat_group.get('labels', [])
                        
                        if stat_group['type'] == 'batting':
                            for athlete in stat_group.get('athletes', []):
                                a_id = safe_int(athlete.get('athlete', {}).get('id'))
                                if not a_id or not athlete.get('stats'): continue
                                
                                # Track new athletes
                                if a_id not in all_athlete_ids:
                                    name_parts = athlete['athlete'].get('shortName', '').split(' ', 1)
                                    fn = name_parts[0] if name_parts else ''
                                    ln = name_parts[1] if len(name_parts) > 1 else ''
                                    new_athlete_records.append({
                                        'athlete_id': a_id,
                                        'first_name': fn,
                                        'last_name': ln,
                                        'full_name': athlete['athlete'].get('displayName', ''),
                                        'display_name': athlete['athlete'].get('shortName', '')
                                    })
                                    all_athlete_ids.add(a_id)

                                stats_dict = dict(zip(labels, athlete['stats']))
                                
                                global_batting.append({
                                    'event_batting_id': f"{eid}_{a_id}",
                                    'event_id': eid,
                                    'team_id': team_id,
                                    'athlete_id': a_id,
                                    'starter': athlete.get('starter', False),
                                    'ab': safe_int(stats_dict.get('AB', 0)),
                                    'r': safe_int(stats_dict.get('R', 0)),
                                    'h': safe_int(stats_dict.get('H', 0)),
                                    'rbi': safe_int(stats_dict.get('RBI', 0)),
                                    'hr': safe_int(stats_dict.get('HR', 0)),
                                    'bb': safe_int(stats_dict.get('BB', 0)),
                                    'k': safe_int(stats_dict.get('K', 0)),
                                    'd': safe_int(stats_dict.get('2B', 0)),
                                    't': safe_int(stats_dict.get('3B', 0)),
                                    'sb': safe_int(stats_dict.get('SB', 0))
                                })
                                
                        elif stat_group['type'] == 'pitching':
                            for athlete in stat_group.get('athletes', []):
                                a_id = safe_int(athlete.get('athlete', {}).get('id'))
                                if not a_id or not athlete.get('stats'): continue
                                
                                # Track new athletes
                                if a_id not in all_athlete_ids:
                                    name_parts = athlete['athlete'].get('shortName', '').split(' ', 1)
                                    fn = name_parts[0] if name_parts else ''
                                    ln = name_parts[1] if len(name_parts) > 1 else ''
                                    new_athlete_records.append({
                                        'athlete_id': a_id,
                                        'first_name': fn,
                                        'last_name': ln,
                                        'full_name': athlete['athlete'].get('displayName', ''),
                                        'display_name': athlete['athlete'].get('shortName', '')
                                    })
                                    all_athlete_ids.add(a_id)

                                stats_dict = dict(zip(labels, athlete['stats']))
                                
                                # Pitcher specific win tracking
                                recorded_win = False
                                txt = athlete.get('notes', [{}])[0].get('text', '') if athlete.get('notes') else ''
                                match = re.search(r'\((.*?)\)', txt)
                                if match and match.group(1) and match.group(1).startswith('W'):
                                    recorded_win = True
                                    
                                global_pitching.append({
                                    'event_pitching_id': f"{eid}_{a_id}",
                                    'event_id': eid,
                                    'team_id': team_id,
                                    'athlete_id': a_id,
                                    'starter': athlete.get('starter', False),
                                    'ip': str(stats_dict.get('IP', '0.0')),
                                    'h': safe_int(stats_dict.get('H', 0)),
                                    'r': safe_int(stats_dict.get('R', 0)),
                                    'er': safe_int(stats_dict.get('ER', 0)),
                                    'bb': safe_int(stats_dict.get('BB', 0)),
                                    'k': safe_int(stats_dict.get('K', 0)),
                                    'hr': safe_int(stats_dict.get('HR', 0)),
                                    'pitches': safe_int(stats_dict.get('PC', 0)),
                                    'recorded_win': recorded_win
                                })
                                
            # --- 4. PLAYS ---
            if 'plays' in data:
                for play in data['plays']:
                    bat_team_id = None
                    if 'team' in play and play['team']: 
                        bat_team_id = safe_int(play['team'].get('id'))
                    elif play.get('participants'): 
                        bat_team_id = safe_int(play['participants'][0].get('athlete', {}).get('team', {}).get('id'))
                    
                    global_plays.append({
                        'play_id': play.get('id'),
                        'event_id': eid,
                        'text': play.get('text'),
                        'type_id': safe_int(play.get('type', {}).get('id')),
                        'type_text': play.get('type', {}).get('text'),
                        'period': safe_int(play.get('period', {}).get('number')),
                        'clock': play.get('clock', {}).get('displayValue'),
                        'scoring_play': play.get('scoringPlay', False),
                        'score_value': safe_int(play.get('scoreValue')),
                        'batting_team_id': bat_team_id
                    })
                    
            # --- 5. WIN PROBABILITY ---
            if 'winprobability' in data:
                for wp in data['winprobability']:
                    global_wp.append({
                        'event_id': eid,
                        'play_id': wp.get('playId'),
                        'home_win_percentage': wp.get('homeWinPercentage')
                    })
                    
        except Exception as e:
            logger.error(f"Error parsing event {eid}: {e}")

    # --- 6. INSERT TO POSTGRES ---
    if global_events:
        with engine.connect() as conn:
            # 6a. ATHLETES (Upsert minimal stubs if missing)
            if new_athlete_records:
                # Remove duplicates in new_athlete_records
                seen_aids = set()
                unique_athletes = []
                for a in new_athlete_records:
                    if a['athlete_id'] not in seen_aids:
                        seen_aids.add(a['athlete_id'])
                        unique_athletes.append(a)
                
                athlete_df = pd.DataFrame(unique_athletes)
                athlete_df.to_sql('athletes', conn, if_exists='append', index=False)
                
            # 6b. EVENTS
            pd.DataFrame(global_events).to_sql('events', conn, if_exists='append', index=False)
            
            # 6c. COMPETITORS
            if global_competitors:
                pd.DataFrame(global_competitors).to_sql('event_competitors', conn, if_exists='append', index=False)
                
            # 6d. BATTING
            if global_batting:
                pd.DataFrame(global_batting).to_sql('event_boxscores_batting', conn, if_exists='append', index=False)
                
            # 6e. PITCHING
            if global_pitching:
                pd.DataFrame(global_pitching).to_sql('event_boxscores_pitching', conn, if_exists='append', index=False)
                
            # 6f. PLAYS (Deduplicate play_ids first)
            if global_plays:
                df_plays = pd.DataFrame(global_plays).drop_duplicates(subset=['play_id'])
                try:
                    df_plays.to_sql('plays', conn, if_exists='append', index=False)
                except Exception as e:
                    logger.error(f"Plays insert failed (probably duplicate play_id): {e}")
                    
            # 6g. WIN PROBABILITY (Deduplicate)
            if global_wp:
                df_wp = pd.DataFrame(global_wp).drop_duplicates(subset=['event_id', 'play_id'])
                try:
                    df_wp.to_sql('win_probabilities', conn, if_exists='append', index=False)
                except Exception as e:
                    logger.error(f"Win Probability insert failed: {e}")

            conn.commit()
            
    return len(events), len(missing_event_ids)

async def run_continuous_backfill():
    logger.info("Initializing Continuous Reverse Backfill...")
    
    # 1. Setup connection limits
    limits = httpx.Limits(max_connections=50, max_keepalive_connections=20)
    semaphore = asyncio.Semaphore(15) # Safe, but fast concurrency limit
    
    async with httpx.AsyncClient(limits=limits) as client:
        
        # 2. Get the baseline starting date (oldest game currently in the database)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT MIN(date) FROM events;")).scalar()
            
            if not result:
                logger.warning("Database 'events' table is empty. Starting from Yesterday.")
                current_date = datetime.now(timezone.utc) - timedelta(days=1)
            else:
                current_date = result - timedelta(days=1)
                
            # Load static context datasets into memory to avoid redundant queries
            logger.info("Loading existing athlete IDs...")
            athlete_ids_df = pd.read_sql("SELECT athlete_id FROM athletes", conn)
            all_athlete_ids = set(athlete_ids_df['athlete_id'].tolist())
            
            logger.info("Loading existing event IDs...")
            events_df = pd.read_sql("SELECT event_id FROM events", conn)
            existing_events = set(events_df['event_id'].tolist())
            
            logger.info("Loading season teams...")
            session_teams_df = pd.read_sql("SELECT * FROM season_teams", conn)
            
        logger.info(f"Starting endless reverse backfill from: {current_date.strftime('%Y-%m-%d')}")
        
        # 3. Endless loop backwards
        consecutive_empty_days = 0
        
        while True:
            try:
                total_games, scraped_games = await scrape_day(
                    client, 
                    current_date, 
                    semaphore, 
                    existing_events, 
                    all_athlete_ids, 
                    session_teams_df
                )
                
                # Check for off-season gaps. If we hit 150 days of 0 games, we've probably hit the end of the API or a massive strike.
                if total_games == 0:
                    consecutive_empty_days += 1
                    if consecutive_empty_days > 150:
                        logger.warning(f"Hit 150 consecutive days with 0 games near {current_date.strftime('%Y-%m-%d')}. Are we out of historical data? Continuing anyway.")
                        consecutive_empty_days = 0 # Reset and keep pushing back
                else:
                    consecutive_empty_days = 0
                    
                # Walk backwards one day
                current_date -= timedelta(days=1)
                
            except Exception as e:
                logger.error(f"Fatal error on {current_date.strftime('%Y-%m-%d')}: {e}")
                logger.info("Pausing for 30s before resuming loop...")
                await asyncio.sleep(30)
                
if __name__ == "__main__":
    asyncio.run(run_continuous_backfill())
