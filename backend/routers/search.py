from fastapi import APIRouter, HTTPException
from typing import Optional
from database import database
import datetime
from datetime import timezone

router = APIRouter()

@router.get("/api/search")
async def global_search(q: str):
    """Search for players and teams based on query string."""
    if not q or len(q) < 2:
        return {"players": [], "teams": []}
        
    query_str = f"%{q}%"
    current_year = datetime.datetime.now(timezone.utc).year
    
    # 1. Search Teams (limit to current year for active teams, but search by name/abbrev)
    teams_query = """
        SELECT DISTINCT team_id, name, display_name, abbreviation
        FROM season_teams
        WHERE season_year = :year 
        AND (name ILIKE :q OR abbreviation ILIKE :q OR display_name ILIKE :q)
        LIMIT 5
    """
    
    # 2. Search Players
    # We want to prioritize active players, but allow searching historical.
    players_query = """
        SELECT 
            a.athlete_id, 
            a.display_name,
            p.abbreviation as position_abbrev,
            COALESCE(
                (
                    SELECT st.abbreviation
                    FROM season_rosters sr
                    JOIN season_teams st ON sr.season_team_id = st.season_team_id
                    WHERE sr.athlete_id = a.athlete_id
                    ORDER BY sr.season_year DESC
                    LIMIT 1
                ),
                (
                    SELECT st.abbreviation
                    FROM event_boxscores_batting b
                    JOIN events e ON b.event_id = e.event_id
                    JOIN season_teams st ON b.team_id = st.team_id AND e.season_year = st.season_year
                    WHERE b.athlete_id = a.athlete_id
                    ORDER BY e.date DESC
                    LIMIT 1
                ),
                (
                    SELECT st.abbreviation
                    FROM event_boxscores_pitching pt
                    JOIN events e ON pt.event_id = e.event_id
                    JOIN season_teams st ON pt.team_id = st.team_id AND e.season_year = st.season_year
                    WHERE pt.athlete_id = a.athlete_id
                    ORDER BY e.date DESC
                    LIMIT 1
                )
            ) as team_abbrev
        FROM athletes a
        LEFT JOIN positions p ON a.position_id = p.position_id
        WHERE a.display_name ILIKE :q OR a.first_name ILIKE :q OR a.last_name ILIKE :q
        ORDER BY a.is_active DESC
        LIMIT 10
    """
    
    teams = await database.fetch_all(query=teams_query, values={"q": query_str, "year": current_year})
    players = await database.fetch_all(query=players_query, values={"q": query_str})
    
    return {
        "teams": [dict(t) for t in teams],
        "players": [dict(p) for p in players]
    }