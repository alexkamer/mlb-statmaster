from fastapi import APIRouter, HTTPException
from typing import Optional
import httpx
from datetime import datetime, timezone
import asyncio
from database import database

router = APIRouter()

@router.get("/api/props/{date}")
async def get_daily_props(date: str, event_ids: Optional[str] = None):
    """Get all saved player props for a specific date (YYYYMMDD)."""
    try:
        formatted_date = f"{date[0:4]}-{date[4:6]}-{date[6:8]}"
        year_val = int(date[0:4])
        
        where_clause = "e.date::text LIKE :date_like"
        values = {"date_like": f"{formatted_date}%", "year_val": year_val}
        
        if event_ids:
            e_ids = [int(eid) for eid in event_ids.split(",") if eid.strip()]
            if e_ids:
                where_clause = "pp.event_id = ANY(:event_ids)"
                values = {"event_ids": e_ids, "year_val": year_val}
        
        query = f"""
            SELECT 
                pp.id, pp.event_id, pp.athlete_id, pp.prop_type, pp.prop_line, pp.over_odds, pp.under_odds, pp.last_updated,
                a.display_name as athlete_name,
                COALESCE(
                    (
                        SELECT st.abbreviation
                        FROM event_boxscores_batting b
                        JOIN season_teams st ON b.team_id = st.team_id
                        WHERE b.athlete_id = pp.athlete_id AND st.season_year = :year_val
                        ORDER BY b.event_id DESC
                        LIMIT 1
                    ),
                    (
                        SELECT st.abbreviation
                        FROM event_boxscores_pitching p
                        JOIN season_teams st ON p.team_id = st.team_id
                        WHERE p.athlete_id = pp.athlete_id AND st.season_year = :year_val
                        ORDER BY p.event_id DESC
                        LIMIT 1
                    ),
                    (
                        SELECT st.abbreviation
                        FROM season_rosters sr
                        JOIN season_teams st ON sr.season_team_id = st.season_team_id
                        WHERE sr.athlete_id = pp.athlete_id
                        ORDER BY sr.season_year DESC
                        LIMIT 1
                    ),
                    'UNK'
                ) as team_abbrev,
                (SELECT t2.abbreviation FROM event_competitors c1 JOIN season_teams t2 ON c1.season_team_id = t2.season_team_id WHERE c1.event_id = pp.event_id AND c1.home_away = 'away' LIMIT 1) as _awayTeam,
                (SELECT c1.team_id FROM event_competitors c1 WHERE c1.event_id = pp.event_id AND c1.home_away = 'away' LIMIT 1) as _awayTeamId,
                (SELECT t2.abbreviation FROM event_competitors c2 JOIN season_teams t2 ON c2.season_team_id = t2.season_team_id WHERE c2.event_id = pp.event_id AND c2.home_away = 'home' LIMIT 1) as _homeTeam,
                (SELECT c2.team_id FROM event_competitors c2 WHERE c2.event_id = pp.event_id AND c2.home_away = 'home' LIMIT 1) as _homeTeamId
            FROM player_props pp
            JOIN athletes a ON pp.athlete_id = a.athlete_id
            LEFT JOIN events e ON pp.event_id = e.event_id
            WHERE {where_clause}
        """
        props = await database.fetch_all(query=query, values=values)
        return [dict(p) for p in props]
    except Exception as e:
        print(f"Error fetching props: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch props")


