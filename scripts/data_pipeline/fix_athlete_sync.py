import pandas as pd
import sqlalchemy
import httpx

engine = sqlalchemy.create_engine("postgresql:///mlb_db")
query = """
SELECT p.athlete_id 
FROM event_boxscores_pitching p 
LEFT JOIN athletes a ON p.athlete_id = a.athlete_id 
WHERE a.athlete_id IS NULL AND p.starter = true
"""
missing = pd.read_sql(query, engine)

def fetch_athlete(aid):
    url = f"https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/athletes/{aid}"
    resp = httpx.get(url, timeout=5.0)
    if resp.status_code == 200:
        data = resp.json()
        return {
            'athlete_id': int(aid),
            'uid': data.get('uid'),
            'first_name': data.get('firstName'),
            'last_name': data.get('lastName'),
            'full_name': data.get('fullName'),
            'display_name': data.get('displayName'),
            'weight': data.get('weight'),
            'height': data.get('height'),
            'age': data.get('age'),
            'bats': data.get('hand', {}).get('type', ''),
            'throws': data.get('hand', {}).get('type', ''), # Fallback if missing
            'is_active': data.get('active', True),
            'position_id': int(data['position']['id']) if 'position' in data else None
        }
    return None

if not missing.empty:
    print(f"Found {len(missing)} missing athletes. Fetching from ESPN...")
    new_athletes = []
    for aid in missing['athlete_id'].unique():
        data = fetch_athlete(aid)
        if data:
            new_athletes.append(data)
            
    if new_athletes:
        df = pd.DataFrame(new_athletes)
        df.to_sql('athletes', engine, if_exists='append', index=False)
        print("Inserted athletes successfully!")
