import asyncio
import json
import httpx
from datetime import datetime, timezone
import databases
import sqlalchemy
from sqlalchemy.dialects.postgresql import insert

DATABASE_URL = "postgresql:///mlb_db"
database = databases.Database(DATABASE_URL)
metadata = sqlalchemy.MetaData()

# Define the table schema for player props
player_props = sqlalchemy.Table(
    "player_props",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.String, primary_key=True),
    sqlalchemy.Column("event_id", sqlalchemy.BigInteger, index=True),
    sqlalchemy.Column("athlete_id", sqlalchemy.BigInteger, index=True),
    sqlalchemy.Column("prop_type", sqlalchemy.String, index=True),
    sqlalchemy.Column("prop_line", sqlalchemy.String),
    sqlalchemy.Column("over_odds", sqlalchemy.String),
    sqlalchemy.Column("under_odds", sqlalchemy.String),
    sqlalchemy.Column("last_updated", sqlalchemy.DateTime(timezone=True)),
)

async def setup_db():
    engine = sqlalchemy.create_engine(DATABASE_URL)
    metadata.create_all(engine)
    await database.connect()

async def get_daily_events():
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    url = f"https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates={today}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        if resp.status_code != 200:
            return []
        data = resp.json()
        return [event["id"] for event in data.get("events", [])]

async def fetch_props_for_event(event_id, client):
    url = f"https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/events/{event_id}/competitions/{event_id}/odds/100/propBets?lang=en&region=us&limit=1000"
    try:
        resp = await client.get(url)
        if resp.status_code != 200:
            return []
        data = resp.json()
        if "items" not in data:
            return []
        return data["items"]
    except Exception as e:
        print(f"Error fetching props for {event_id}: {e}")
        return []

def extract_athlete_id(ref_url):
    if not ref_url: return None
    import re
    match = re.search(r"athletes/(\d+)", ref_url)
    return int(match.group(1)) if match else None

async def process_props(event_id, items):
    
    # Group by athlete and prop type
    grouped = {}
    for item in items:
        if "athlete" not in item or "$ref" not in item["athlete"]:
            continue
        
        a_id = extract_athlete_id(item["athlete"]["$ref"])
        if not a_id: continue
        
        p_type = item.get("type", {}).get("name")
        if not p_type: continue
        
        target = item.get("current", {}).get("target", {}).get("displayValue")
        if target is None:
            target = item.get("current", {}).get("target", {}).get("value")
            
        target_str = str(target) if target is not None else "N/A"
        if p_type == "To Record Win" and target_str == "N/A":
            target_str = "0.5"
        
        key = f"{a_id}_{p_type}_{target_str}"
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(item)
        
    records = []
    for key, bets in grouped.items():
        parts = key.split("_")
        a_id = int(parts[0])
        p_type = parts[1]
        target_str = parts[2]
        
        over_odds = None
        under_odds = None
        
        if len(bets) == 2:
            over_odds = bets[0].get("odds", {}).get("american", {}).get("value")
            under_odds = bets[1].get("odds", {}).get("american", {}).get("value")
        elif len(bets) == 1:
            over_odds = bets[0].get("odds", {}).get("american", {}).get("value")
            
        last_updated_str = bets[0].get("lastUpdated")
        try:
            # typical format: "2026-03-30T13:46Z"
            if last_updated_str.endswith("Z"):
                last_updated = datetime.strptime(last_updated_str, "%Y-%m-%dT%H:%MZ").replace(tzinfo=timezone.utc)
            else:
                last_updated = datetime.now(timezone.utc)
        except:
            last_updated = datetime.now(timezone.utc)

        # Create a unique ID for the upsert
        record_id = f"{event_id}_{a_id}_{p_type.replace(' ', '')}_{target_str}"
        
        records.append({
            "id": record_id,
            "event_id": int(event_id),
            "athlete_id": a_id,
            "prop_type": p_type,
            "prop_line": target_str,
            "over_odds": str(over_odds) if over_odds else None,
            "under_odds": str(under_odds) if under_odds else None,
            "last_updated": last_updated
        })
        
    if records:
        stmt = insert(player_props).values(records)
        stmt = stmt.on_conflict_do_update(
            index_elements=['id'],
            set_={
                "prop_line": stmt.excluded.prop_line,
                "over_odds": stmt.excluded.over_odds,
                "under_odds": stmt.excluded.under_odds,
                "last_updated": stmt.excluded.last_updated,
            }
        )
        await database.execute(stmt)

async def main():
    await setup_db()
    print("Fetching today's events...")
    event_ids = await get_daily_events()
    print(f"Found {len(event_ids)} events.")
    
    async with httpx.AsyncClient() as client:
        for eid in event_ids:
            items = await fetch_props_for_event(eid, client)
            if items:
                print(f"Event {eid}: Found {len(items)} prop items.")
                await process_props(eid, items)
            else:
                print(f"Event {eid}: No props found (might be live/finished).")
                
    await database.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
