import pandas as pd
from sqlalchemy import create_engine, text, exc, MetaData, Table
from sqlalchemy.dialects.postgresql import insert
import httpx
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

DATABASE_URL = "postgresql:///mlb_db"
engine = create_engine(DATABASE_URL)
metadata = MetaData()

def execute_upsert(df, table_name, pk_cols):
    if df.empty: return
    records = df.to_dict(orient='records')
    try:
        table = Table(table_name, metadata, autoload_with=engine)
    except exc.NoSuchTableError:
        df.to_sql(table_name, engine, index=False)
        with engine.begin() as conn:
            pk_str = ', '.join(pk_cols)
            conn.execute(text(f"ALTER TABLE {table_name} ADD PRIMARY KEY ({pk_str})"))
        return
    stmt = insert(table).values(records)
    update_dict = {c.name: c for c in stmt.excluded if c.name not in pk_cols}
    if not update_dict:
        stmt = stmt.on_conflict_do_nothing(index_elements=pk_cols)
    else:
        stmt = stmt.on_conflict_do_update(index_elements=pk_cols, set_=update_dict)
    with engine.begin() as conn:
        conn.execute(stmt)

def fetch_data(client, url, max_retries=3):
    for attempt in range(max_retries):
        try:
            resp = client.get(url, timeout=10.0)
            if resp.status_code in [403, 429]:
                wait_time = (2 ** attempt) + 1
                time.sleep(wait_time)
                continue
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            if attempt == max_retries - 1:
                return None
            time.sleep((2 ** attempt) + 1)
    return None

def process_odds(event_id, data):
    records = []
    if not data or 'items' not in data:
        return records
    for item in data['items']:
        provider = item.get('provider', {})
        provider_id = provider.get('id')
        if not provider_id:
            continue
        
        away_odds = item.get('awayTeamOdds', {})
        home_odds = item.get('homeTeamOdds', {})
        
        records.append({
            'event_odds_id': f"{event_id}_{provider_id}",
            'event_id': int(event_id),
            'provider_id': int(provider_id),
            'provider_name': provider.get('name'),
            'details': item.get('details'),
            'over_under': item.get('overUnder'),
            'spread': item.get('spread'),
            'over_odds': item.get('overOdds'),
            'under_odds': item.get('underOdds'),
            'away_money_line': away_odds.get('moneyLine'),
            'home_money_line': home_odds.get('moneyLine')
        })
    return records

def main():
    with engine.connect() as conn:
        result = conn.execute(text("SELECT event_id FROM events"))
        all_events = [row[0] for row in result]
        
        try:
            result = conn.execute(text("SELECT DISTINCT event_id FROM event_odds"))
            existing_events = set([row[0] for row in result])
        except exc.ProgrammingError:
            # Table might not exist yet
            existing_events = set()
            
    events_to_fetch = [eid for eid in all_events if eid not in existing_events]
    print(f"Total events: {len(all_events)}, Already have odds: {len(existing_events)}, To fetch: {len(events_to_fetch)}")
    
    # Process in batches
    batch_size = 500
    for i in range(0, len(events_to_fetch), batch_size):
        batch = events_to_fetch[i:i+batch_size]
        print(f"Processing batch {i//batch_size + 1}, starting with {batch[0]}")
        
        urls = {f"https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/events/{eid}/competitions/{eid}/odds": eid for eid in batch}
        batch_records = []
        
        with httpx.Client(limits=httpx.Limits(max_connections=50)) as client:
            with ThreadPoolExecutor(max_workers=30) as executor:
                future_to_url = {executor.submit(fetch_data, client, url): url for url in urls}
                for future in as_completed(future_to_url):
                    url = future_to_url[future]
                    eid = urls[url]
                    try:
                        data = future.result()
                        records = process_odds(eid, data)
                        batch_records.extend(records)
                    except Exception as e:
                        print(f"Failed to process odds for event {eid}: {e}")
                        
        if batch_records:
            df = pd.DataFrame(batch_records)
            execute_upsert(df, 'event_odds', ['event_odds_id'])
            print(f"Upserted {len(df)} odds records.")
        else:
            print("No odds found in this batch (or all were 404/empty).")

if __name__ == '__main__':
    main()
