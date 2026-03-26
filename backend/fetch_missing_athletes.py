import httpx
import pandas as pd
from sqlalchemy import create_engine, MetaData, Table
from sqlalchemy.dialects.postgresql import insert
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

DATABASE_URL = "postgresql:///mlb_db"
engine = create_engine(DATABASE_URL)

# Find all athlete IDs in the boxscores that do NOT exist in the athletes table
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

print(f"Found {len(missing_ids)} missing athletes in boxscores. Fetching bios...")

def fetch_data(client, url):
    for attempt in range(3):
        resp = client.get(url)
        if resp.status_code == 404: return None # Some players don't exist anymore
        if resp.status_code == 403 or resp.status_code == 429:
            time.sleep((2 ** attempt) + 1)
            continue
        resp.raise_for_status()
        return resp.json()
    return None

athlete_records = []
with httpx.Client(limits=httpx.Limits(max_connections=50)) as client:
    with ThreadPoolExecutor(max_workers=30) as executor:
        urls = [f"https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/athletes/{aid}" for aid in missing_ids]
        future_to_url = {executor.submit(fetch_data, client, url): url for url in urls}
        
        for i, future in enumerate(as_completed(future_to_url)):
            if i > 0 and i % 50 == 0:
                print(f"  ...processed {i}/{len(urls)}")
            try:
                a_data = future.result()
                if a_data:
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
                        'date_of_birth': pd.to_datetime(a_data.get('dateOfBirth'), utc=True).replace(tzinfo=None) if a_data.get('dateOfBirth') else None,
                        'birth_city': a_data.get('birthPlace', {}).get('city'),
                        'birth_state': a_data.get('birthPlace', {}).get('state'),
                        'birth_country': a_data.get('birthPlace', {}).get('country'),
                        'bats': a_data.get('bats', {}).get('abbreviation'),
                        'throws': a_data.get('throws', {}).get('abbreviation'),
                        'is_active': a_data.get('active', False),
                        'position_id': int(a_data.get('position', {}).get('$ref', '').split('/positions/')[1].split('?')[0]) if 'position' in a_data else None
                    })
            except:
                pass

if athlete_records:
    df = pd.DataFrame(athlete_records)
    metadata = MetaData()
    table = Table('athletes', metadata, autoload_with=engine)
    stmt = insert(table).values(df.to_dict(orient='records'))
    stmt = stmt.on_conflict_do_nothing(index_elements=['athlete_id'])
    
    with engine.begin() as conn:
        conn.execute(stmt)
    print(f"Saved {len(athlete_records)} missing athletes to the database!")
else:
    print("No missing athletes found or fetched.")
