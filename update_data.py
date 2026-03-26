import sys
import time
import httpx
import pandas as pd
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from sqlalchemy import create_engine, MetaData, Table, text

# ==========================================
# CONFIGURATION
# ==========================================
DATABASE_URL = "postgresql:///mlb_db"
from datetime import timezone
CURRENT_YEAR = datetime.now(timezone.utc).year

engine = create_engine(DATABASE_URL)
metadata = MetaData()

def fetch_data(client, url, max_retries=3):
    import time
    for attempt in range(max_retries):
        resp = client.get(url)
        if resp.status_code == 403 or resp.status_code == 429:
            wait_time = (2 ** attempt) + 1
            print(f"Rate limited (403/429) on {url}. Retrying in {wait_time}s...")
            time.sleep(wait_time)
            continue
        resp.raise_for_status()
        return resp.json()
    raise Exception(f"Failed to fetch {url} after {max_retries} attempts due to rate limiting.")

def execute_upsert(df, table_name, pk_cols):
    """
    Performs an efficient UPSERT (INSERT ... ON CONFLICT DO UPDATE) in PostgreSQL.
    """
    if df.empty:
        return
        
    records = df.to_dict(orient='records')
    
    from sqlalchemy.dialects.postgresql import insert
    from sqlalchemy import exc

    try:
        table = Table(table_name, metadata, autoload_with=engine)
    except exc.NoSuchTableError:
        df.to_sql(table_name, engine, index=False)
        # Add primary key to the newly created table
        with engine.begin() as conn:
            pk_str = ', '.join(pk_cols)
            conn.execute(text(f"ALTER TABLE {table_name} ADD PRIMARY KEY ({pk_str})"))
        return

    stmt = insert(table).values(records)
    update_dict = {c.name: c for c in stmt.excluded if c.name not in pk_cols}
    
    if not update_dict:
        stmt = stmt.on_conflict_do_nothing(index_elements=pk_cols)
    else:
        stmt = stmt.on_conflict_do_update(
            index_elements=pk_cols,
            set_=update_dict
        )
        
    with engine.begin() as conn:
        conn.execute(stmt)

# ==========================================
# 1. Update Core Season & Teams
# ==========================================
def update_season_and_teams():
    print(f"\n--- Updating MLB Data for {CURRENT_YEAR} ---")
    start_time = time.time()
    
    seasons_records = []
    season_types_records = []
    teams_records = []
    
    with httpx.Client(limits=httpx.Limits(max_connections=50)) as client:
        # 1A. Fetch Current Season
        season_url = f"https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/{CURRENT_YEAR}?lang=en&region=us"
        try:
            s_data = fetch_data(client, season_url)
            seasons_records.append({
                'season_year': int(s_data.get('year')),
                'start_date': pd.to_datetime(s_data.get('startDate'), utc=True),
                'end_date': pd.to_datetime(s_data.get('endDate'), utc=True),
                'display_name': s_data.get('displayName')
            })
            
            if 'types' in s_data and 'items' in s_data['types']:
                for s_type in s_data['types']['items']:
                    season_types_records.append({
                        'season_type_id': f"{s_data.get('year')}_{s_type.get('id')}",
                        'season_year': int(s_data.get('year')), 
                        'type_id': int(s_type.get('id')),
                        'name': s_type.get('name'),
                        'abbreviation': s_type.get('abbreviation'),
                        'start_date': pd.to_datetime(s_type.get('startDate'), utc=True) if s_type.get('startDate') else None,
                        'end_date': pd.to_datetime(s_type.get('endDate'), utc=True) if s_type.get('endDate') else None,
                        'has_standings': s_type.get('hasStandings', False)
                    })
        except Exception as e:
            print(f"Error fetching season {CURRENT_YEAR}: {e}")
            return
            
        if seasons_records:
            execute_upsert(pd.DataFrame(seasons_records), 'seasons', ['season_year'])
            execute_upsert(pd.DataFrame(season_types_records), 'season_types', ['season_type_id'])
            print("✓ Updated dimensions.")
            
        # 1B. Fetch Current Teams
        teams_url = f"https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/{CURRENT_YEAR}/teams?lang=en&region=us&limit=150"
        try:
            teams_index = fetch_data(client, teams_url)
            team_urls = [item['$ref'] for item in teams_index.get('items', [])]
            
            with ThreadPoolExecutor(max_workers=30) as executor:
                future_to_url = {executor.submit(fetch_data, client, url): url for url in team_urls}
                for future in as_completed(future_to_url):
                    try:
                        t_data = future.result()
                        team_id = int(t_data.get('id'))
                        teams_records.append({
                            'season_team_id': f"{CURRENT_YEAR}_{team_id}",
                            'season_year': CURRENT_YEAR,
                            'team_id': team_id,
                            'uid': t_data.get('uid'),
                            'location': t_data.get('location'),
                            'name': t_data.get('name'),
                            'abbreviation': t_data.get('abbreviation'),
                            'display_name': t_data.get('displayName'),
                            'color': t_data.get('color'),
                            'alternate_color': t_data.get('alternateColor'),
                            'is_active': t_data.get('isActive'),
                            'franchise_id': int(t_data.get('franchise', {}).get('$ref', '').split('/franchises/')[1].split('?')[0]) if 'franchise' in t_data else None,
                            'venue_id': int(t_data.get('venue', {}).get('$ref', '').split('/venues/')[1].split('?')[0]) if 'venue' in t_data else None,
                            'group_id': int(t_data.get('groups', {}).get('$ref', '').split('/groups/')[1].split('?')[0]) if 'groups' in t_data else None,
                        })
                    except Exception:
                        pass
        except Exception as e:
            print(f"Error fetching teams index: {e}")
            
        if teams_records:
            df_teams = pd.DataFrame(teams_records)
            execute_upsert(df_teams, 'season_teams', ['season_team_id'])
            print(f"✓ Updated {len(df_teams)} teams for {CURRENT_YEAR}.")
            
        return df_teams

# ==========================================
# 2. Update Rosters & Athletes
# ==========================================
def update_rosters_and_athletes(df_teams):
    if df_teams is None or df_teams.empty:
        return
        
    print("\n--- Updating Rosters for {CURRENT_YEAR} ---")
    roster_urls = [
        f"https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/{CURRENT_YEAR}/teams/{row.team_id}/athletes?lang=en&region=us&limit=150"
        for row in df_teams.itertuples()
    ]
    
    roster_records = []
    athlete_refs = set()
    
    with httpx.Client(limits=httpx.Limits(max_connections=100)) as client:
        with ThreadPoolExecutor(max_workers=30) as executor:
            future_to_url = {executor.submit(fetch_data, client, url): url for url in roster_urls}
            for future in as_completed(future_to_url):
                try:
                    data = future.result()
                    url = future_to_url[future]
                    team_id = int(url.split('/')[-2])
                    
                    if 'items' in data:
                        for item in data['items']:
                            a_ref = item['$ref']
                            athlete_id = int(a_ref.split('/athletes/')[1].split('?')[0])
                            athlete_refs.add(a_ref)
                            
                            roster_records.append({
                                'roster_id': f"{CURRENT_YEAR}_{team_id}_{athlete_id}",
                                'season_team_id': f"{CURRENT_YEAR}_{team_id}",
                                'season_year': CURRENT_YEAR,
                                'team_id': team_id,
                                'athlete_id': athlete_id,
                            })
                except Exception:
                    pass

        # Since a 30-min cron job means rosters can change fluidly (trades/call-ups), 
        # we completely OVERWRITE the current season's rosters in the database to ensure an exact match.

        if roster_records:
            df_rosters = pd.DataFrame(roster_records)
            with engine.begin() as conn:
                try:
                    conn.execute(text(f"DELETE FROM season_rosters WHERE season_year = {CURRENT_YEAR}"))
                except:
                    pass # Table likely doesn't exist yet, which is fine
            df_rosters.to_sql('season_rosters', engine, if_exists='append', index=False)
            print(f"✓ Replaced {len(df_rosters)} roster spots to reflect live state.")


        # Find which athletes we ALREADY have in our database
        try:
            existing_df = pd.read_sql("SELECT athlete_id FROM athletes", engine)
            existing_ids = set(existing_df['athlete_id'].tolist())
        except:
            existing_ids = set()
            
        new_athlete_refs = []
        for ref in athlete_refs:
            aid = int(ref.split('/athletes/')[1].split('?')[0])
            if aid not in existing_ids:
                new_athlete_refs.append(ref)
                
        if not new_athlete_refs:
            print("✓ No new athletes to fetch. Skipping biographical update.")
            return
            
        print(f"Found {len(new_athlete_refs)} brand new athletes! Fetching bios...")
        athlete_records = []
        with ThreadPoolExecutor(max_workers=50) as executor:
            future_to_url = {executor.submit(fetch_data, client, url): url for url in new_athlete_refs}
            for future in as_completed(future_to_url):
                try:
                    a_data = future.result()
                    athlete_records.append({
                        'athlete_id': int(a_data.get('id')),
                        'uid': a_data.get('uid'),
                        'first_name': a_data.get('firstName'),
                        'last_name': a_data.get('lastName'),
                        'full_name': a_data.get('fullName'),
                        'display_name': a_data.get('displayName'),
                        'weight': a_data.get('weight'),
                        'height': a_data.get('height'),
                        'age': a_data.get('age'),
                        'date_of_birth': pd.to_datetime(a_data.get('dateOfBirth'), utc=True) if a_data.get('dateOfBirth') else None,
                        'birth_city': a_data.get('birthPlace', {}).get('city'),
                        'birth_state': a_data.get('birthPlace', {}).get('state'),
                        'birth_country': a_data.get('birthPlace', {}).get('country'),
                        'bats': a_data.get('bats', {}).get('abbreviation'),
                        'throws': a_data.get('throws', {}).get('abbreviation'),
                        'is_active': a_data.get('active', False),
                        'position_id': int(a_data.get('position', {}).get('$ref', '').split('/positions/')[1].split('?')[0]) if 'position' in a_data else None
                    })
                except Exception:
                    pass
                    
        if athlete_records:
            execute_upsert(pd.DataFrame(athlete_records), 'athletes', ['athlete_id'])
            print(f"✓ Added {len(athlete_records)} new athletes to database.")


# ==========================================
# 3. Update Deep Game Data (Events, Boxscores, Plays)
# ==========================================
def safe_int(val):
    if val is None or str(val) == '--' or str(val) == '':
        return None
    try:
        return int(float(str(val)))
    except:
        return None

def update_game_data():
    print("\n--- Updating Game Data (Last 48 Hours) ---")
    # To be extremely safe on a 30-min cron job, we check games scheduled for today AND yesterday
    today_str = datetime.now(timezone.utc).strftime('%Y%m%d')
    yesterday_str = (datetime.now(timezone.utc) - timedelta(days=1)).strftime('%Y%m%d')
    
    event_refs = []
    
    with httpx.Client(limits=httpx.Limits(max_connections=50)) as client:
        for date_str in [yesterday_str, today_str]:
            url = f"https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/events?dates={date_str}&limit=500"
            try:
                resp = fetch_data(client, url)
                if 'items' in resp:
                    event_refs.extend([item['$ref'] for item in resp['items']])
            except Exception as e:
                print(f"Error fetching event index for {date_str}: {e}")
                
        event_refs = list(set(event_refs))
        if not event_refs:
            print("No games scheduled for today or yesterday. Skipping game update.")
            return

        print(f"Found {len(event_refs)} scheduled games. Fetching summaries...")
        
        summary_urls = [f"https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event={url.split('/events/')[1].split('?')[0]}&region=us&lang=en" for url in event_refs]
        summary_urls = [url.replace("sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/summary", "site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary") for url in summary_urls]
        
        global_events = []
        global_competitors = []
        global_batting = []
        global_pitching = []
        global_plays = []
        global_wp = []
        
        with ThreadPoolExecutor(max_workers=50) as executor:
            future_to_url = {executor.submit(fetch_data, client, url): url for url in summary_urls}
            
            for future in as_completed(future_to_url):
                try:
                    data = future.result()
                    
                    status = data.get('header', {}).get('competitions', [{}])[0].get('status', {}).get('type', {}).get('name')
                    # If a game is IN_PROGRESS during our cron job, we SKIP saving its plays to the database.
                    # We only save games once they are FINAL, POSTPONED, or CANCELED so we don't accidentally
                    # write partial play-by-play logs that we'd have to clean up later.
                    if status not in ['STATUS_FINAL', 'STATUS_POSTPONED', 'STATUS_CANCELED']:
                        continue
                    
                    event_id = safe_int(data.get('header', {}).get('id'))
                    if not event_id: continue
                    season_year = safe_int(data.get('header', {}).get('season', {}).get('year', CURRENT_YEAR))
                    
                    # 1. EVENT
                    global_events.append({
                        'event_id': event_id,
                        'date': pd.to_datetime(data.get('header', {}).get('competitions', [{}])[0].get('date'), utc=True).replace(tzinfo=None),
                        'name': data.get('header', {}).get('name'),
                        'short_name': data.get('header', {}).get('competitions', [{}])[0].get('shortName'),
                        'season_year': season_year,
                        'attendance': data.get('gameInfo', {}).get('attendance'),
                        'venue_id': safe_int(data.get('gameInfo', {}).get('venue', {}).get('id')) if data.get('gameInfo', {}).get('venue') else None
                    })
                    
                    # 2. COMPETITORS
                    for team in data.get('header', {}).get('competitions', [{}])[0].get('competitors', []):
                        team_id = safe_int(team.get('id'))
                        if not team_id: continue
                        global_competitors.append({
                            'event_competitor_id': f"{event_id}_{team_id}",
                            'event_id': event_id,
                            'team_id': team_id,
                            'season_team_id': f"{season_year}_{team_id}",
                            'home_away': team.get('homeAway'),
                            'winner': team.get('winner'),
                            'score': safe_int(team.get('score'))
                        })
                        
                    # 3. BOXSCORES
                    boxscore = data.get('boxscore', {})
                    for team_box in boxscore.get('players', []):
                        team_id = safe_int(team_box.get('team', {}).get('id'))
                        if not team_id: continue
                        
                        for stat_group in team_box.get('statistics', []):
                            stat_name = stat_group.get('type')
                            labels = stat_group.get('labels', [])
                            
                            for athlete_stats in stat_group.get('athletes', []):
                                athlete_id = safe_int(athlete_stats.get('athlete', {}).get('id'))
                                if not athlete_id: continue
                                
                                stats_list = athlete_stats.get('stats', [])
                                if not stats_list: continue
                                stat_dict = dict(zip(labels, stats_list))
                                
                                if stat_name == "batting":
                                    global_batting.append({
                                        'event_batting_id': f"{event_id}_{athlete_id}",
                                        'event_id': event_id,
                                        'team_id': team_id,
                                        'athlete_id': athlete_id,
                                        'starter': athlete_stats.get('starter', False),
                                        'position_id': safe_int(athlete_stats.get('position', {}).get('id')) if athlete_stats.get('position') else None,
                                        'ab': safe_int(stat_dict.get('AB')),
                                        'r': safe_int(stat_dict.get('R')),
                                        'h': safe_int(stat_dict.get('H')),
                                        'rbi': safe_int(stat_dict.get('RBI')),
                                        'hr': safe_int(stat_dict.get('HR')),
                                        'bb': safe_int(stat_dict.get('BB')),
                                        'k': safe_int(stat_dict.get('K')),
                                        'pitches_faced': safe_int(stat_dict.get('#P'))
                                    })
                                elif stat_name == "pitching":
                                    global_pitching.append({
                                        'event_pitching_id': f"{event_id}_{athlete_id}",
                                        'event_id': event_id,
                                        'team_id': team_id,
                                        'athlete_id': athlete_id,
                                        'starter': athlete_stats.get('starter', False),
                                        'ip': stat_dict.get('IP', stat_dict.get('fullInnings.partInnings')),
                                        'h': safe_int(stat_dict.get('H')),
                                        'r': safe_int(stat_dict.get('R')),
                                        'er': safe_int(stat_dict.get('ER')),
                                        'bb': safe_int(stat_dict.get('BB')),
                                        'k': safe_int(stat_dict.get('K')),
                                        'hr': safe_int(stat_dict.get('HR')),
                                        'pitches': safe_int(stat_dict.get('PC'))
                                    })
                                    
                    # 4. PLAYS
                    for play in data.get('plays', []):
                        global_plays.append({
                            'play_id': play.get('id'),
                            'event_id': event_id,
                            'inning': safe_int(play.get('period', {}).get('number')),
                            'is_scoring_play': play.get('scoringPlay', False),
                            'score_value': safe_int(play.get('scoreValue')),
                            'away_score': safe_int(play.get('awayScore')),
                            'home_score': safe_int(play.get('homeScore')),
                            'play_type_id': safe_int(play.get('type', {}).get('id')) if play.get('type') else None,
                            'play_type_text': play.get('type', {}).get('text'),
                            'text': play.get('text'),
                            'pitch_type': play.get('pitchType', {}).get('text'),
                            'pitch_velocity': play.get('pitchVelocity'),
                            'pitch_coordinate_x': play.get('pitchCoordinate', {}).get('x'),
                            'pitch_coordinate_y': play.get('pitchCoordinate', {}).get('y'),
                            'hit_coordinate_x': play.get('hitCoordinate', {}).get('x'),
                            'hit_coordinate_y': play.get('hitCoordinate', {}).get('y')
                        })
                        
                    # 5. WIN PROBABILITY
                    for wp in data.get('winprobability', []):
                        global_wp.append({
                            'play_id': wp.get('playId'),
                            'event_id': event_id,
                            'home_win_percentage': wp.get('homeWinPercentage'),
                            'tie_percentage': wp.get('tiePercentage')
                        })
                        
                except Exception as e:
                    print(f"Error processing completed game: {e}")

        # --- UPSERT ALL COMPLETED GAMES ---
        # We use execute_upsert so we don't accidentally duplicate plays if the script
        # runs twice in an hour on the same finished game.
        if global_events:
            df_e = pd.DataFrame(global_events).drop_duplicates('event_id')
            df_e['venue_id'] = df_e['venue_id'].astype('Int64')
            execute_upsert(df_e, 'events', ['event_id'])
            print(f"✓ Saved {len(df_e)} finished events.")
            
        if global_competitors:
            df_c = pd.DataFrame(global_competitors).drop_duplicates('event_competitor_id')
            df_c['score'] = df_c['score'].astype('Int64')
            execute_upsert(df_c, 'event_competitors', ['event_competitor_id'])
            
        if global_batting:
            df_b = pd.DataFrame(global_batting).drop_duplicates('event_batting_id')
            for col in ['position_id', 'ab', 'r', 'h', 'rbi', 'hr', 'bb', 'k', 'pitches_faced']:
                df_b[col] = df_b[col].astype('Int64')
            execute_upsert(df_b, 'event_boxscores_batting', ['event_batting_id'])
            
        if global_pitching:
            df_p = pd.DataFrame(global_pitching).drop_duplicates('event_pitching_id')
            for col in ['h', 'r', 'er', 'bb', 'k', 'hr', 'pitches']:
                df_p[col] = df_p[col].astype('Int64')
            execute_upsert(df_p, 'event_boxscores_pitching', ['event_pitching_id'])
            
        if global_plays:
            df_pl = pd.DataFrame(global_plays).drop_duplicates('play_id')
            for col in ['inning', 'score_value', 'away_score', 'home_score', 'play_type_id']:
                df_pl[col] = df_pl[col].astype('Int64')
            execute_upsert(df_pl, 'event_plays', ['play_id'])
            print(f"✓ Saved {len(df_pl)} plays.")
            
        if global_wp:
            df_wp = pd.DataFrame(global_wp).drop_duplicates('play_id')
            execute_upsert(df_wp, 'event_win_probability', ['play_id'])

if __name__ == "__main__":
    t0 = time.time()
    try:
        # 1. Ensure core season framework exists
        df_current_teams = update_season_and_teams()
        
        # 2. Maintain active 40-man rosters & biographical data
        update_rosters_and_athletes(df_current_teams)
        
        # 3. Pull down completed box scores & play-by-play for recent games
        update_game_data()
        
    except Exception as e:
        print(f"\nCRITICAL UPDATE FAILURE: {e}")
        
    print(f"\nCron Update Cycle Completed in {time.time() - t0:.2f} seconds.")
