import pandas as pd
from sqlalchemy import create_engine

# Connect to the local database we just created
DATABASE_URL = "postgresql:///mlb_db"
engine = create_engine(DATABASE_URL)

try:
    print("==================================================")
    print("                MLB DATABASE INSPECTION")
    print("==================================================\n")

    # 1. Inspect Seasons
    print("--- 1. SEASONS TABLE ---")
    query = "SELECT COUNT(*) as total_years, MIN(season_year) as oldest, MAX(season_year) as newest FROM seasons;"
    summary = pd.read_sql(query, engine)
    print(summary.to_string(index=False))
    
    print("\nRecent 3 seasons:")
    recent_seasons = pd.read_sql("SELECT season_year, start_date, end_date FROM seasons ORDER BY season_year DESC LIMIT 3;", engine)
    print(recent_seasons.to_string(index=False))
    print("\n--------------------------------------------------\n")

    # 2. Inspect Season Types
    print("--- 2. SEASON TYPES TABLE ---")
    query = "SELECT COUNT(*) as total_types FROM season_types;"
    summary = pd.read_sql(query, engine)
    print(summary.to_string(index=False))
    
    print("\nBreakdown of 2024 season phases:")
    types_2024 = pd.read_sql("SELECT name, abbreviation, start_date FROM season_types WHERE season_year = 2024 ORDER BY type_id;", engine)
    print(types_2024.to_string(index=False))
    print("\n--------------------------------------------------\n")

    # 3. Inspect Season Teams
    print("--- 3. SEASON TEAMS TABLE ---")
    query = "SELECT COUNT(*) as total_historical_teams FROM season_teams;"
    summary = pd.read_sql(query, engine)
    print(summary.to_string(index=False))
    
    print("\nProof of historical accuracy: Searching for Team ID 20 across time...")
    historical_team = pd.read_sql("""
        SELECT season_year, location, name, display_name 
        FROM season_teams 
        WHERE team_id = 20 AND (season_year = 1990 OR season_year = 2024)
        ORDER BY season_year;
    """, engine)
    print(historical_team.to_string(index=False))
    
    print("==================================================\n")

except Exception as e:
    print(f"\nError connecting to the database or querying tables:\n{e}")
    print("\nDid you remember to run the final cell in 'grab_data.ipynb' first?")