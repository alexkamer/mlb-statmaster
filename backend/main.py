from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import databases
import sqlalchemy

DATABASE_URL = "postgresql:///mlb_db"

database = databases.Database(DATABASE_URL)
metadata = sqlalchemy.MetaData()

app = FastAPI(title="MLB Statmaster API")

# Allow the React frontend to make requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://0.0.0.0:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await database.connect()

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()

@app.get("/api/teams")
async def get_teams(year: int = 2024):
    """Get all teams active in a specific year."""
    query = """
        SELECT team_id, location, name, display_name, abbreviation, color, alternate_color
        FROM season_teams
        WHERE season_year = :year
        ORDER BY location
    """
    return await database.fetch_all(query=query, values={"year": year})

@app.get("/api/teams/{team_id}/stats")
async def get_team_stats(team_id: int, year: int = 2024, season_type: str = "All"):
    """Calculate aggregate team statistics from the boxscores."""
    
    type_filter = ""
    if season_type == "Preseason": type_filter = " AND st.type_id = 1 "
    elif season_type == "Regular Season": type_filter = " AND st.type_id = 2 "
    elif season_type == "Postseason": type_filter = " AND st.type_id = 3 "
    
    query = f"""
        SELECT 
            SUM(b.ab) as total_ab,
            SUM(b.h) as total_hits,
            SUM(b.hr) as total_hr,
            SUM(b.r) as total_runs,
            ROUND(SUM(b.h)::numeric / NULLIF(SUM(b.ab), 0), 3) as team_avg
        FROM event_boxscores_batting b
        JOIN events e ON b.event_id = e.event_id
        LEFT JOIN season_types st ON e.season_year = st.season_year AND e.date >= st.start_date AND e.date <= st.end_date
        WHERE b.team_id = :team_id AND e.season_year = :year{type_filter}
    """
    stats = await database.fetch_one(query=query, values={"team_id": team_id, "year": year})
    return dict(stats)

@app.get("/api/teams/{team_id}/roster")
async def get_team_roster_stats(team_id: int, year: int = 2024, season_type: str = "All"):
    """Get the active roster and their calculated batting stats for the season."""
    
    type_filter = ""
    if season_type == "Preseason": type_filter = " AND st.type_id = 1 "
    elif season_type == "Regular Season": type_filter = " AND st.type_id = 2 "
    elif season_type == "Postseason": type_filter = " AND st.type_id = 3 "
    
    query = f"""
        SELECT 
            a.athlete_id,
            a.full_name,
            a.display_name,
            p.abbreviation as position,
            'https://a.espncdn.com/i/headshots/mlb/players/full/' || a.athlete_id || '.png' as headshot,
            -- Construct the headshot URL natively in SQL
            'https://a.espncdn.com/i/headshots/mlb/players/full/' || a.athlete_id || '.png' as headshot,
            COUNT(DISTINCT b.event_id) as g,
            SUM(b.ab) as ab,
            SUM(b.r) as r,
            SUM(b.h) as h,
            SUM(b.hr) as hr,
            SUM(b.rbi) as rbi,
            ROUND(SUM(b.h)::numeric / NULLIF(SUM(b.ab), 0), 3) as avg,
            ROUND(
                ((SUM(b.h) + SUM(b.bb))::numeric / NULLIF(SUM(b.ab) + SUM(b.bb), 0)) + 
                ((SUM(b.h) + (SUM(b.hr) * 3))::numeric / NULLIF(SUM(b.ab), 0)), 
            3) as ops
        FROM event_boxscores_batting b
        JOIN events e ON b.event_id = e.event_id
        LEFT JOIN season_types st ON e.season_year = st.season_year AND e.date >= st.start_date AND e.date <= st.end_date
        LEFT JOIN athletes a ON b.athlete_id = a.athlete_id
        LEFT JOIN positions p ON a.position_id = p.position_id
        WHERE b.team_id = :team_id AND e.season_year = :year{type_filter}
        GROUP BY a.athlete_id, a.full_name, a.display_name, p.abbreviation
        ORDER BY ab DESC NULLS LAST
    """
    return await database.fetch_all(query=query, values={"team_id": team_id, "year": year})

@app.get("/api/teams/{team_id}/roster/pitching")
async def get_team_pitching_stats(team_id: int, year: int = 2024, season_type: str = "All"):
    """Get the active roster and their calculated pitching stats for the season."""
    
    type_filter = ""
    if season_type == "Preseason": type_filter = " AND st.type_id = 1 "
    elif season_type == "Regular Season": type_filter = " AND st.type_id = 2 "
    elif season_type == "Postseason": type_filter = " AND st.type_id = 3 "
    
    query = f"""
        SELECT 
            a.athlete_id,
            a.full_name,
            a.display_name,
            p.abbreviation as position,
            COUNT(DISTINCT pb.event_id) as g,
            -- Rough IP calculation: sum of integers + (sum of decimals / 3)
            SUM(CAST(SPLIT_PART(pb.ip, '.', 1) AS INTEGER)) + 
            (SUM(CAST(COALESCE(NULLIF(SPLIT_PART(pb.ip, '.', 2), ''), '0') AS INTEGER)) / 3.0) as ip_approx,
            SUM(pb.h) as h,
            SUM(pb.r) as r,
            SUM(pb.er) as er,
            SUM(pb.bb) as bb,
            SUM(pb.k) as k,
            SUM(pb.hr) as hr
        FROM event_boxscores_pitching pb
        JOIN events e ON pb.event_id = e.event_id
        LEFT JOIN season_types st ON e.season_year = st.season_year AND e.date >= st.start_date AND e.date <= st.end_date
        LEFT JOIN athletes a ON pb.athlete_id = a.athlete_id
        LEFT JOIN positions p ON a.position_id = p.position_id
        WHERE pb.team_id = :team_id AND e.season_year = :year{type_filter}
        GROUP BY a.athlete_id, a.full_name, a.display_name, p.abbreviation
        ORDER BY ip_approx DESC NULLS LAST
    """
    
    rows = await database.fetch_all(query=query, values={"team_id": team_id, "year": year})
    
    results = []
    for r in rows:
        d = dict(r)
        ip = float(d['ip_approx'] or 0)
        er = float(d['er'] or 0)
        
        era = round((9.0 * er / ip), 2) if ip > 0 else 0.00
        d['era'] = f"{era:.2f}"
        
        full_innings = int(ip)
        partial_innings = round((ip - full_innings) * 3)
        if partial_innings == 3:
            full_innings += 1
            partial_innings = 0
            
        d['ip'] = f"{full_innings}.{partial_innings}" if partial_innings > 0 else str(full_innings)
        
        results.append(d)
        
    return results


@app.get("/api/teams/{team_id}/recent_games")
async def get_recent_games(team_id: int, limit: int = 5):
    """Get the recent results for a team."""
    query = """
        SELECT 
            e.event_id,
            e.date,
            e.name as matchup,
            c1.score as team_score,
            c2.score as opponent_score,
            c2.team_id as opponent_id,
            c1.winner
        FROM events e
        JOIN event_competitors c1 ON e.event_id = c1.event_id AND c1.team_id = :team_id
        JOIN event_competitors c2 ON e.event_id = c2.event_id AND c2.team_id != :team_id
        WHERE c1.score IS NOT NULL
        ORDER BY e.date DESC
        LIMIT :limit
    """
    return await database.fetch_all(query=query, values={"team_id": team_id, "limit": limit})

@app.get("/api/games")
async def get_all_games(year: int = 2024, page: int = 1, limit: int = 50, season_type: str = "All"):
    """Get a paginated list of all games in a specific season, optionally filtered by type."""
    offset = (page - 1) * limit
    
    type_filter = ""
    if season_type == "Preseason": type_filter = " AND st.type_id = 1 "
    elif season_type == "Regular Season": type_filter = " AND st.type_id = 2 "
    elif season_type == "Postseason": type_filter = " AND st.type_id = 3 "
    
    count_query = f"""
        SELECT COUNT(*) 
        FROM events e
        LEFT JOIN season_types st ON e.season_year = st.season_year AND e.date >= st.start_date AND e.date <= st.end_date
        WHERE e.season_year = :year{type_filter}
    """
    total_count = await database.fetch_val(query=count_query, values={"year": year})
    
    query = f"""
        SELECT 
            e.event_id,
            e.date,
            e.name as matchup,
            e.short_name,
            c1.score as home_score,
            c1.team_id as home_team_id,
            c2.score as away_score,
            c2.team_id as away_team_id
        FROM events e
        LEFT JOIN season_types st ON e.season_year = st.season_year AND e.date >= st.start_date AND e.date <= st.end_date
        JOIN event_competitors c1 ON e.event_id = c1.event_id AND c1.home_away = 'home'
        JOIN event_competitors c2 ON e.event_id = c2.event_id AND c2.home_away = 'away'
        WHERE e.season_year = :year{type_filter}
        ORDER BY e.date DESC
        LIMIT :limit OFFSET :offset
    """
    
    games = await database.fetch_all(query=query, values={"year": year, "limit": limit, "offset": offset})
    
    return {
        "data": [dict(g) for g in games],
        "meta": {
            "total_items": total_count,
            "page": page,
            "limit": limit,
            "total_pages": (total_count + limit - 1) // limit if total_count else 0
        }
    }

@app.get("/api/teams/{team_id}/games")
async def get_team_games_paginated(team_id: int, year: int = 2024, page: int = 1, limit: int = 20, season_type: str = "All"):
    """Get a paginated list of games for a specific team, dynamically classifying season type by date."""
    offset = (page - 1) * limit
    
    type_filter = ""
    if season_type == "Preseason": type_filter = " AND st.type_id = 1 "
    elif season_type == "Regular Season": type_filter = " AND st.type_id = 2 "
    elif season_type == "Postseason": type_filter = " AND st.type_id = 3 "
    
    count_query = f"""
        SELECT COUNT(*) 
        FROM event_competitors c
        JOIN events e ON c.event_id = e.event_id
        LEFT JOIN season_types st ON e.season_year = st.season_year AND e.date >= st.start_date AND e.date <= st.end_date
        WHERE c.team_id = :team_id AND e.season_year = :year{type_filter}
    """
    total_count = await database.fetch_val(query=count_query, values={"team_id": team_id, "year": year})
    
    query = f"""
        SELECT 
            e.event_id,
            e.date,
            e.name as matchup,
            e.short_name,
            COALESCE(st.name, 'Game') as season_type_name,
            c1.score as team_score,
            c2.score as opponent_score,
            c2.team_id as opponent_id,
            t2.display_name as opponent_name,
            t2.abbreviation as opponent_abbreviation,
            c1.winner,
            c1.home_away as location
        FROM events e
        LEFT JOIN season_types st ON e.season_year = st.season_year AND e.date >= st.start_date AND e.date <= st.end_date
        JOIN event_competitors c1 ON e.event_id = c1.event_id AND c1.team_id = :team_id
        JOIN event_competitors c2 ON e.event_id = c2.event_id AND c2.team_id != :team_id
        LEFT JOIN season_teams t2 ON c2.season_team_id = t2.season_team_id
        WHERE e.season_year = :year{type_filter}
        ORDER BY e.date DESC
        LIMIT :limit OFFSET :offset
    """
    
    games = await database.fetch_all(query=query, values={"team_id": team_id, "year": year, "limit": limit, "offset": offset})
    
    return {
        "data": [dict(g) for g in games],
        "meta": {
            "total_items": total_count,
            "page": page,
            "limit": limit,
            "total_pages": (total_count + limit - 1) // limit if total_count else 0
        }
    }


@app.get("/api/teams/{team_id}/live_roster")
async def get_live_team_roster(team_id: int):
    """Fetch the live 40-man roster directly from ESPN."""
    import httpx
    url = f"https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/{team_id}/roster"
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url)
            if resp.status_code != 200:
                return [] 
            
            data = resp.json()
            roster_list = []
            for category in data.get('athletes', []):
                group_name = category.get('position', 'Unknown')
                for player in category.get('items', []):
                    roster_list.append({
                        "athlete_id": int(player.get("id")),
                        "full_name": player.get("fullName"),
                        "display_name": player.get("displayName"),
                        "position": player.get("position", {}).get("abbreviation"),
                        "jersey": player.get("jersey"),
                        "headshot": player.get("headshot", {}).get("href"),
                        "bats": player.get("bats", {}).get("abbreviation"),
                        "throws": player.get("throws", {}).get("abbreviation"),
                        "height": player.get("displayHeight"),
                        "weight": player.get("displayWeight"),
                        "age": player.get("age"),
                        "status": player.get("status", {}).get("type"),
                        "roster_group": group_name
                    })
            return roster_list
        except:
            return []


@app.get("/api/seasons")
async def get_seasons():
    """Get a list of all available seasons in the database."""
    query = """
        SELECT season_year, start_date, end_date, display_name 
        FROM seasons 
        ORDER BY season_year DESC
    """
    return await database.fetch_all(query=query)
