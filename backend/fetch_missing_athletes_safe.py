import httpx
import pandas as pd
from sqlalchemy import create_engine, MetaData, Table
from sqlalchemy.dialects.postgresql import insert
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

DATABASE_URL = "postgresql:///mlb_db"
engine = create_engine(DATABASE_URL)

query = """
    SELECT DISTINCT athlete_id FROM (
        SELECT athlete_id FROM event_boxscores_batting
        UNION
        SELECT athlete_id FROM event_boxscores_pitching
    ) combined
    WHERE athlete_id NOT IN (SELECT athlete_id FROM athletes)
"""
missing_df = pd.read_sql(query, engine)
missing_ids = missing_df['athlete_id'].tolist()

print(f"Found {len(missing_ids)} missing athletes. Fetching bios...")

def fetch_data(client, url):
    for attempt in range(3):
        resp = client.get(url)
        if resp.status_code == 404: return None
        if resp.status_code in [403, 429]:
            time.sleep((2 ** attempt) + 1)
            continue
        resp.raise_for_status()
        return resp.json()
    return None

def safe_float(val):
    try: return float(val)
    except: return None
    
def safe_int(val):
    try: return int(float(val))
    except: return None

athlete_records = []
with httpx.Client(limits=httpx.Limits(max_connections=50)) as client:
    with ThreadPoolExecutor(max_workers=30) as executor:
        urls = [f"https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/athletes/{aid}" for aid in missing_ids]
        for i, future in enumerate(as_completed({executor.submit(fetch_data, client, url): url for url in urls})):
            if i > 0 and i % 100 == 0: print(f"  ...processed {i}/{len(urls)}")
            try:
                a_data = future.result()
                if a_data:
                    # Clean the data to avoid NaT/NaN psycopg2 crashes
                    dob = a_data.get('dateOfBirth')
                    athlete_records.append({
                        'athlete_id': safe_int(a_data.get('id')),
                        'uid': a_data.get('uid'),
                        'first_name': a_data.get('firstName'),
                        'last_name': a_data.get('lastName'),
                        'full_name': a_data.get('fullName'),
                        'display_name': a_data.get('displayName'),
                        'weight': safe_float(a_data.get('weight')),
                        'height': safe_float(a_data.get('height')),
                        'age': safe_float(a_data.get('age')),
                        'date_of_birth': pd.to_datetime(dob, utc=True).replace(tzinfo=None) if dob else None,
                        'birth_city': a_data.get('birthPlace', {}).get('city'),
                        'birth_state': a_data.get('birthPlace', {}).get('state'),
                        'birth_country': a_data.get('birthPlace', {}).get('country'),
                        'bats': a_data.get('bats', {}).get('abbreviation'),
                        'throws': a_data.get('throws', {}).get('abbreviation'),
                        'is_active': bool(a_data.get('active', False)),
                        'position_id': safe_int(a_data.get('position', {}).get('$ref', '').split('/positions/')[1].split('?')[0]) if 'position' in a_data else None
                    })
            except:
                pass

if athlete_records:
    df = pd.DataFrame(athlete_records)
    # Replace NaT and NaN with literal None so psycopg2 safely inserts SQL NULLs
    df = df.where(pd.notnull(df), None)
    
    metadata = MetaData()
    table = Table('athletes', metadata, autoload_with=engine)
    
    # We chunk the insert so we don't blow up the SQL statement limit
    for i in range(0, len(df), 1000):
        chunk = df.iloc[i:i+1000]
        stmt = insert(table).values(chunk.to_dict(orient='records'))
        stmt = stmt.on_conflict_do_nothing(index_elements=['athlete_id'])
        with engine.begin() as conn:
            conn.execute(stmt)
            
    print(f"Saved {len(athlete_records)} missing athletes to the database!")
