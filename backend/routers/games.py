from fastapi import APIRouter, HTTPException
from typing import Optional
import httpx
from datetime import datetime, timezone
import asyncio
from database import database

router = APIRouter()

@router.get("/api/games")
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


@router.get("/api/seasons")
async def get_seasons():
    """Get a list of all available seasons in the database."""
    query = """
        SELECT season_year, start_date, end_date, display_name 
        FROM seasons 
        ORDER BY season_year DESC
    """
    return await database.fetch_all(query=query)





@router.get("/api/games/{game_id}/props")
async def get_game_props_proxy(game_id: str):
    """Proxy the ESPN prop bets endpoint to prevent client-side 404 console errors."""
    url = f"https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/events/{game_id}/competitions/{game_id}/odds/100/propBets?lang=en&region=us&limit=1000"

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url)
            if resp.status_code == 404:
                return {"items": []} # Return empty 200 OK so the browser doesn't log an error

            data = resp.json()
            if "items" in data:
                athlete_ids = []
                for item in data["items"]:
                    athlete = item.get("athlete")
                    if athlete and "$ref" in athlete:
                        ref_url = athlete["$ref"]
                        parts = ref_url.split("/athletes/")
                        if len(parts) > 1:
                            aid = parts[1].split("?")[0]
                            if aid.isdigit():
                                athlete_ids.append(int(aid))

                if athlete_ids:
                    athlete_ids = list(set(athlete_ids))
                    query = "SELECT athlete_id, display_name FROM athletes WHERE athlete_id = ANY(:athlete_ids)"
                    rows = await database.fetch_all(query=query, values={"athlete_ids": athlete_ids})
                    name_map = {row["athlete_id"]: row["display_name"] for row in rows}

                    missing_ids = [aid for aid in athlete_ids if aid not in name_map]
                    if missing_ids:
                        async def fetch_name(aid):
                            try:
                                a_url = f"https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/athletes/{aid}?lang=en&region=us"
                                a_resp = await client.get(a_url, timeout=3.0)
                                if a_resp.status_code == 200:
                                    a_data = a_resp.json()
                                    if "displayName" in a_data:
                                        name_map[aid] = a_data["displayName"]
                            except Exception:
                                pass

                        await asyncio.gather(*[fetch_name(aid) for aid in missing_ids])

                    for item in data["items"]:
                        athlete = item.get("athlete")
                        if athlete and "$ref" in athlete:
                            ref_url = athlete["$ref"]
                            parts = ref_url.split("/athletes/")
                            if len(parts) > 1:
                                aid = parts[1].split("?")[0]
                                if aid.isdigit():
                                    aid_int = int(aid)
                                    if aid_int in name_map and name_map[aid_int]:
                                        athlete["displayName"] = name_map[aid_int]

            return data
        except Exception as e:
            print(f"Error in proxy: {e}")
            return {"items": []}
@router.get("/api/games/{game_id}/odds")
async def get_game_odds(game_id: int):
    """Fetch cached game odds from our database."""
    query = """
        SELECT provider_id, provider_name as name, details, over_under as "overUnder", 
               over_odds as "overOdds", under_odds as "underOdds", 
               away_money_line, home_money_line, spread as "spreadOdds"
        FROM event_odds
        WHERE event_id = :game_id
        LIMIT 1
    """
    
    odds = await database.fetch_one(query=query, values={"game_id": game_id})
    if not odds:
        return None
        
    odds_dict = dict(odds)
    return {
        "provider": {"id": odds_dict["provider_id"], "name": odds_dict["name"]},
        "details": odds_dict["details"],
        "overUnder": odds_dict["overUnder"],
        "overOdds": odds_dict["overOdds"],
        "underOdds": odds_dict["underOdds"],
        "awayTeamOdds": {"moneyLine": odds_dict["away_money_line"], "spreadOdds": odds_dict["spreadOdds"]},
        "homeTeamOdds": {"moneyLine": odds_dict["home_money_line"], "spreadOdds": odds_dict["spreadOdds"]}
    }
