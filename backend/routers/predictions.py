from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime
import logging
from database import database
import predictions

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/api/predictions/analyze")
async def analyze_game(
    game_id: int, 
    away_team_id: Optional[int] = None, 
    home_team_id: Optional[int] = None, 
    away_pitcher_id: Optional[int] = None, 
    home_pitcher_id: Optional[int] = None, 
    date: Optional[str] = None
):
    if away_team_id and home_team_id and date:
        # We have all the context we need from the frontend directly!
        as_of_date = datetime.fromisoformat(date.replace('Z', '+00:00')).replace(tzinfo=None)
        away_team = away_team_id
        home_team = home_team_id
        away_p = away_pitcher_id if away_pitcher_id else None
        home_p = home_pitcher_id if home_pitcher_id else None
    else:
        # Get game details from DB
        query = """
            SELECT e.date, c_away.team_id as away_team, c_home.team_id as home_team
            FROM events e
            JOIN event_competitors c_away ON e.event_id = c_away.event_id AND c_away.home_away = 'away'
            JOIN event_competitors c_home ON e.event_id = c_home.event_id AND c_home.home_away = 'home'
            WHERE e.event_id = :game_id
        """
        game_row = await database.fetch_one(query=query, values={"game_id": game_id})
        if not game_row:
            raise HTTPException(status_code=404, detail="Game not found in database and parameters not provided.")

        as_of_date = game_row["date"]
        away_team = game_row["away_team"]
        home_team = game_row["home_team"]

        # Try to find probable pitchers from our pitching boxscores if the game started
        pitcher_query = """
            SELECT team_id, athlete_id
            FROM event_boxscores_pitching
            WHERE event_id = :game_id AND starter = true
        """
        pitchers = await database.fetch_all(query=pitcher_query, values={"game_id": game_id})
        
        away_p = None
        home_p = None
        
        for p in pitchers:
            if p["team_id"] == away_team:
                away_p = p["athlete_id"]
            elif p["team_id"] == home_team:
                home_p = p["athlete_id"]

    try:
        analysis = await predictions.analyze_matchup(
            away_team_id=away_team,
            home_team_id=home_team,
            away_pitcher_id=away_p,
            home_pitcher_id=home_p,
            as_of_date=as_of_date
        )
        return analysis
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail="Failed to run prediction analysis.")