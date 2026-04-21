import httpx
import sqlalchemy
import pandas as pd

DATABASE_URL = "postgresql:///mlb_db"
engine = sqlalchemy.create_engine(DATABASE_URL)

def sync_today_probables():
    # Use 20260405 based on our target backtest date
    date_str = '20260405'
    url = f"https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates={date_str}"
    print(f"Fetching ESPN Scoreboard for {date_str}...")
    
    try:
        resp = httpx.get(url, timeout=10.0)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"Error fetching scoreboard: {e}")
        return
        
    events = data.get('events', [])
    print(f"Found {len(events)} games.")
    
    new_pitchers = []
    
    for event in events:
        event_id = event['id']
        comp = event['competitions'][0]
        
        for competitor in comp['competitors']:
            team_id = competitor['id']
            probables = competitor.get('probables', [])
            
            if probables:
                athlete = probables[0]['athlete']
                athlete_id = athlete['id']
                # Create a fake event_pitching_id using event_id and athlete_id so it doesn't conflict
                event_pitching_id = f"{event_id}_{athlete_id}"
                
                # Check if they exist in event_boxscores_pitching
                query = f"SELECT 1 FROM event_boxscores_pitching WHERE event_id = {event_id} AND athlete_id = {athlete_id} AND starter = true"
                existing = pd.read_sql(query, engine)
                
                if existing.empty:
                    new_pitchers.append({
                        'event_pitching_id': event_pitching_id,
                        'event_id': int(event_id),
                        'team_id': int(team_id),
                        'athlete_id': int(athlete_id),
                        'starter': True,
                        'ip': '0.0', # Placeholder to not break math
                        'h': 0, 'r': 0, 'er': 0, 'bb': 0, 'k': 0, 'hr': 0, 'pitches': 0
                    })
                    print(f"Found missing probable: {athlete['displayName']} ({team_id}) for game {event_id}")

    if new_pitchers:
        df_new = pd.DataFrame(new_pitchers)
        df_new.to_sql('event_boxscores_pitching', engine, if_exists='append', index=False)
        print(f"Successfully inserted {len(df_new)} missing starting pitchers into the database.")
    else:
        print("All probable pitchers are already in the database.")

if __name__ == '__main__':
    sync_today_probables()
