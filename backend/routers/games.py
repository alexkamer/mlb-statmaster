from fastapi import APIRouter, HTTPException
import httpx
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

@router.get("/api/games/{game_id}/race_to_x")
async def get_race_to_x_history(game_id: int, target: int = 3):
    """Calculate historical Race to X performance for both teams in the matchup."""
    # 1. Fetch matchup context
    query_context = """
        SELECT e.date, c_away.team_id as away_team_id, c_home.team_id as home_team_id
        FROM events e
        JOIN event_competitors c_away ON e.event_id = c_away.event_id AND c_away.home_away = 'away'
        JOIN event_competitors c_home ON e.event_id = c_home.event_id AND c_home.home_away = 'home'
        WHERE e.event_id = :game_id
    """
    context = await database.fetch_one(query=query_context, values={"game_id": game_id})
    if not context:
        raise HTTPException(status_code=404, detail="Game context not found.")

    game_date = context["date"]
    away_team_id = context["away_team_id"]
    home_team_id = context["home_team_id"]

    # 2. Build the race_to_x history query
    history_query = """
        SELECT
            e.event_id,
            e.date,
            c1.home_away as team_location,
            c2.team_id as opp_team_id,
            c1.score as final_team_score,
            c2.score as final_opp_score,
            (
                SELECT
                    CASE
                        WHEN ep.away_score >= :target_runs AND ep.home_score < :target_runs THEN 'away'
                        WHEN ep.home_score >= :target_runs AND ep.away_score < :target_runs THEN 'home'
                        WHEN ep.away_score >= :target_runs AND ep.home_score >= :target_runs THEN 'tie'
                        ELSE NULL
                    END
                FROM event_plays ep
                WHERE ep.event_id = e.event_id
                  AND (ep.away_score >= :target_runs OR ep.home_score >= :target_runs)
                ORDER BY ep.play_id ASC
                LIMIT 1
            ) as first_to_x_winner_location
        FROM events e
        JOIN event_competitors c1 ON e.event_id = c1.event_id AND c1.team_id = :team_id
        JOIN event_competitors c2 ON e.event_id = c2.event_id AND c2.team_id != :team_id
        WHERE e.date < :game_date AND c1.score IS NOT NULL
        ORDER BY e.date DESC
        LIMIT 10
    """

    away_history = await database.fetch_all(query=history_query, values={"team_id": away_team_id, "game_date": game_date, "target_runs": target})
    home_history = await database.fetch_all(query=history_query, values={"team_id": home_team_id, "game_date": game_date, "target_runs": target})

    def process_history(history_records):
        results = []
        for r in history_records:
            d = dict(r)
            winner_loc = d["first_to_x_winner_location"]
            if winner_loc is None:
                d["race_result"] = "push"
            elif winner_loc == "tie":
                d["race_result"] = "push"
            elif winner_loc == d["team_location"]:
                d["race_result"] = "win"
            else:
                d["race_result"] = "loss"
            results.append(d)
        return results

    return {
        "away_team_id": away_team_id,
        "home_team_id": home_team_id,
        "target": target,
        "away_history": process_history(away_history),
        "home_history": process_history(home_history)
    }

