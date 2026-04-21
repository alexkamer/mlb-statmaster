from fastapi import APIRouter
import httpx
import asyncio
from database import database

router = APIRouter()

async def fetch_pitcher_splits(athlete_id: int, season: int = 2026):
    url = f"http://site.api.espn.com/apis/common/v3/sports/baseball/mlb/athletes/{athlete_id}/splits?season={season}"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, timeout=5.0)
            if resp.status_code == 200:
                data = resp.json()
                cats = data.get("splitCategories", [])
                for cat in cats:
                    if cat.get("name") == "byRightLeft":
                        splits = cat.get("splits", [])
                        labels = cat.get("labels", [])
                        # Map splits into a dict of { "vs LHB": {...}, "vs RHB": {...} }
                        result = {}
                        for s in splits:
                            name = s.get("displayName", s.get("name", ""))
                            stats_arr = s.get("stats", [])
                            stats_dict = dict(zip(labels, stats_arr))
                            if "vs. Left" in name:
                                result["vs LHB"] = stats_dict
                            elif "vs. Right" in name:
                                result["vs RHB"] = stats_dict
                        
                        if result.get("vs LHB") or result.get("vs RHB"):
                            result["_season"] = season
                            return result
        except Exception as e:
            print(f"Error fetching splits for {athlete_id}: {e}")
            
    # If we get here, no valid splits found for this season. Try previous season if we asked for 2026.
    if season == 2026:
        return await fetch_pitcher_splits(athlete_id, season=2025)
        
    return {"vs LHB": None, "vs RHB": None}

async def get_pitcher_analysis(athlete_id: int, team_id: int, opp_team_id: int):
    # 1. Team W-L in starts
    starts_query = """
        SELECT count(*) as starts, sum(case when c.winner then 1 else 0 end) as wins 
        FROM event_boxscores_pitching bp 
        JOIN event_competitors c ON bp.event_id = c.event_id AND bp.team_id = c.team_id 
        WHERE bp.athlete_id = :athlete_id AND bp.starter = true
    """
    starts_row = await database.fetch_one(query=starts_query, values={"athlete_id": athlete_id})
    team_record = {"starts": 0, "wins": 0, "losses": 0}
    if starts_row and starts_row["starts"] > 0:
        team_record["starts"] = starts_row["starts"]
        team_record["wins"] = starts_row["wins"]
        team_record["losses"] = starts_row["starts"] - starts_row["wins"]

    # 2. Handedness & Opponent vs Hand
    throws_query = "SELECT throws FROM athletes WHERE athlete_id = :athlete_id"
    throws_row = await database.fetch_one(query=throws_query, values={"athlete_id": athlete_id})
    throws = throws_row["throws"] if throws_row else None

    opp_vs_hand = None
    if throws:
        opp_query = """
            SELECT 
                SUM(b.h) as hits,
                SUM(b.ab) as at_bats,
                SUM(b.hr) as hr,
                SUM(b.bb) as bb,
                SUM(b.k) as strikeouts,
                SUM(b.rbi) as rbi
            FROM event_boxscores_batting b
            JOIN events e ON b.event_id = e.event_id
            JOIN event_competitors c ON e.event_id = c.event_id AND b.team_id != c.team_id
            JOIN event_boxscores_pitching bp ON c.event_id = bp.event_id AND c.team_id = bp.team_id AND bp.starter = true
            JOIN athletes p ON bp.athlete_id = p.athlete_id
            WHERE b.team_id = :opp_team_id AND p.throws = :throws AND e.season_year = 2026
        """
        opp_row = await database.fetch_one(query=opp_query, values={"opp_team_id": opp_team_id, "throws": throws})
        if opp_row and opp_row["at_bats"] and opp_row["at_bats"] > 0:
            h = opp_row["hits"] or 0
            ab = opp_row["at_bats"] or 0
            avg = h / ab if ab > 0 else 0
            opp_vs_hand = {
                "throws": throws,
                "hits": h,
                "ab": ab,
                "avg": f"{avg:.3f}".replace("0.", "."),
                "hr": opp_row["hr"] or 0,
                "k": opp_row["strikeouts"] or 0,
                "bb": opp_row["bb"] or 0,
                "rbi": opp_row["rbi"] or 0
            }

    # 3. L/R Splits from ESPN
    splits = await fetch_pitcher_splits(athlete_id)

    return {
        "teamRecord": team_record,
        "throws": throws,
        "opponentVsHand": opp_vs_hand,
        "splits": splits
    }

@router.get("/api/pitchers/matchup-analysis")
async def matchup_analysis(away_pitcher_id: int, away_team_id: int, home_pitcher_id: int, home_team_id: int):
    # Run both simultaneously
    away_task = get_pitcher_analysis(away_pitcher_id, away_team_id, home_team_id)
    home_task = get_pitcher_analysis(home_pitcher_id, home_team_id, away_team_id)
    
    away_res, home_res = await asyncio.gather(away_task, home_task)
    
    return {
        "away": away_res,
        "home": home_res
    }
