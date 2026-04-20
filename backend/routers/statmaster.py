import os
import json
import traceback
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Any
from google import genai
from database import database
import logging
from dotenv import load_dotenv
from prompts.statmaster_prompts import DB_SCHEMA, STATMASTER_NLU_PROMPT
from utils.statmaster_helpers import sum_innings_pitched

# Load environment variables from the root .env file
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/ask",
    tags=["statmaster"]
)

# Define structured output schemas
class SqlQueryResponse(BaseModel):
    sql_query: str = Field(description="The valid PostgreSQL query to execute.")
    subject_id: Optional[int] = Field(description="Return the exact athlete_id or team_id ONLY if it was explicitly queried and verified, otherwise return null.", default=None)
    subject_type: Optional[str] = Field(description="Whether the subject is a 'player' or 'team'.", default=None)
    related_queries: Optional[List[str]] = Field(description="2-3 interesting follow-up questions the user might ask about this specific player, team, or stat.", default=None)

class StatmasterResponse(BaseModel):
    query: str = Field(description="The original user query.")
    answerText: str = Field(description="A concise, conversational one-sentence summary of the answer, like a sports announcer would say.")
    primaryImage: Optional[str] = Field(description="URL to an image of the subject. Use https://a.espncdn.com/i/headshots/mlb/players/full/{subjectId}.png for players, or https://a.espncdn.com/i/teamlogos/mlb/500/{abbrev}.png for teams, or None.", default=None)
    primaryImageAlt: Optional[str] = Field(description="Alt text for the image.", default=None)
    subjectName: Optional[str] = Field(description="The name of the primary subject (player or team) being discussed.", default=None)
    subjectType: Optional[str] = Field(description="Either 'player' or 'team'.", default=None)
    subjectId: Optional[int] = Field(description="The ID of the subject, matching the image.", default=None)
    columns: List[str] = Field(description="Array of column names for the data table.")
    rows: List[List[Any]] = Field(description="Array of arrays containing the row data matching the columns.")
    rowLinks: Optional[List[Optional[str]]] = Field(description="Optional array of URLs for each row, if the row should be clickable.", default=None)
    relatedQueries: Optional[List[str]] = Field(description="2-3 related follow-up questions the user might ask.", default=None)
    primaryColumnIndex: Optional[int] = Field(description="The zero-based index of the column that represents the primary stat requested.", default=None)
    heroStats: Optional[List[dict]] = Field(description="Array of up to 4 key stats to highlight as badges.", default=None)
    recentGames: Optional[dict] = Field(description="A secondary table containing recent gamelogs.", default=None)

@router.get("")
@router.get("/")
async def ask_statmaster(q: str = Query(..., description="The user's question")):
    try:
        # The client gets the API key from the environment variable `GEMINI_API_KEY`
        client = genai.Client()
        model_name = "gemini-2.5-flash-lite"
    except Exception as e:
         logger.error(f"Failed to initialize GenAI client: {e}")
         raise HTTPException(status_code=500, detail="Failed to initialize AI client. Check GEMINI_API_KEY.")

    # Dynamically determine the "current" season based on the most recent event
    try:
        current_season = await database.fetch_val("SELECT MAX(season_year) FROM events")
        if not current_season:
            current_season = 2024 # fallback
    except Exception as e:
        logger.warning(f"Failed to fetch max season_year: {e}")
        current_season = 2024

    # ==========================================
    # STEP 1: NLU -> SQL Generation
    # ==========================================
    nlu_prompt = STATMASTER_NLU_PROMPT.replace("{DB_SCHEMA}", DB_SCHEMA).replace("{current_season}", str(current_season)).replace("{q}", q)
    logger.info(f"Generating SQL for query: {q}")
    
    try:
        # Request structured output for SQL
        response = client.models.generate_content(
            model=model_name,
            contents=nlu_prompt,
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=SqlQueryResponse,
                temperature=0.1
            ),
        )
        
        # Parse the JSON string from response.text using pydantic or json
        sql_data_dict = json.loads(response.text)
        sql_query = sql_data_dict.get('sql_query')
        subject_id = sql_data_dict.get('subject_id')
        subject_type = sql_data_dict.get('subject_type')
        related_queries = sql_data_dict.get('related_queries') or ["Show me more stats like this."]
        
        logger.info(f"Generated SQL: {sql_query}")
        
    except Exception as e:
        logger.error(f"SQL Generation Error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to understand the question.")

    # ==========================================
    # STEP 2: Database Execution
    # ==========================================
    try:
        # Safety check: enforce read-only
        if not sql_query.strip().upper().startswith("SELECT"):
            raise ValueError("Only SELECT queries are allowed.")
            
        # Execute query
        results = await database.fetch_all(query=sql_query)
        
        # Format results to a simple list of dicts
        raw_rows = []
        for row in results:
            d = dict(row)
            # If the LLM returned an IP array for safe math, compute it here
            if 'ip_array' in d:
                d['ip'] = sum_innings_pitched(d['ip_array'])
                del d['ip_array'] # remove the raw array from the final table
            raw_rows.append(d)
        
    except Exception as e:
        logger.error(f"Database Execution Error: {e}\nQuery: {sql_query}")
        raw_rows = []

    # ==========================================
    # FAST PATH: NO SECOND LLM CALL
    # ==========================================
    if not raw_rows:
        return {
            "query": q,
            "answerText": "I couldn't find any data for that question right now.",
            "primaryImage": None,
            "primaryImageAlt": None,
            "subjectName": None,
            "subjectType": None,
            "subjectId": None,
            "columns": [],
            "rows": [],
            "relatedQueries": [],
            "primaryColumnIndex": None
        }

    # Attempt to format the columns and rows purely in python to save 3-4 seconds of LLM latency
    columns = list(raw_rows[0].keys())
    
    # Hide internal IDs and repetitive names from the UI table
    visible_columns = [col for col in columns if col not in ['athlete_id', 'team_id', 'full_name', 'display_name', 'event_id']]
    
    # Process rows to match Statmuse gamelog format (TEAM, @/vs, OPP)
    formatted_rows = []
    row_links = []
    
    # Determine if this looks like a gamelog by checking for our specific column names
    is_gamelog = all(k in columns for k in ['team_abbr', 'opponent_abbr', 'home_away'])
    
    if is_gamelog:
        # Reorder and format columns
        ui_columns = []
        for col in visible_columns:
            if col == 'team_abbr':
                ui_columns.append('TEAM')
            elif col == 'home_away':
                ui_columns.append('')
            elif col == 'opponent_abbr':
                ui_columns.append('OPP')
            else:
                ui_columns.append(col.upper().replace('_', ' '))
                
        # Reorder and format rows
        for row in raw_rows:
            row_links.append(f"/games/{row['event_id']}" if 'event_id' in row and row['event_id'] else None)
            formatted_row = []
            for col in visible_columns:
                val = row[col]
                if col == 'home_away':
                    formatted_row.append('vs' if str(val).lower() == 'home' else '@')
                elif col == 'date' and val:
                    # Format date to mm/dd/yyyy (e.g. 04/19/2026)
                    try:
                        import datetime
                        if isinstance(val, str):
                            # Try parsing string if the DB didn't return a date object
                            try:
                                dt = datetime.datetime.fromisoformat(val.replace('Z', '+00:00'))
                                formatted_row.append(dt.strftime('%m/%d/%Y'))
                            except ValueError:
                                # Fallback string slicing for YYYY-MM-DD
                                formatted_row.append(f"{val[5:7]}/{val[8:10]}/{val[0:4]}")
                        else:
                            formatted_row.append(val.strftime('%m/%d/%Y'))
                    except Exception:
                        formatted_row.append(str(val))
                else:
                    formatted_row.append(str(val) if val is not None else "0")
            formatted_rows.append(formatted_row)
            
        upper_columns = ui_columns
        # Do not highlight TEAM column in gamelogs
        primary_col_index = None 
    else:
        # Default behavior
        for row in raw_rows:
            row_links.append(f"/games/{row['event_id']}" if 'event_id' in row and row['event_id'] else None)
            formatted_row = [str(row[col]) if row[col] is not None else "0" for col in visible_columns]
            formatted_rows.append(formatted_row)
        
        # Make columns uppercase for the UI
        upper_columns = [col.upper().replace('_', ' ') for col in visible_columns]
        primary_col_index = 1 if len(upper_columns) > 1 else 0
        
    # Attempt to extract Hero Stats for beautiful badge display
    hero_stats = None
    if len(formatted_rows) == 1 and not is_gamelog:
        # If it's a single aggregate row (career or season totals), extract the top counting stats
        hero_stats = []
        row_dict = dict(zip(upper_columns, formatted_rows[0]))
        
        # Priority stats to grab
        priority = ['HR', 'RBI', 'H', 'R', 'SB', 'W', 'SO', 'K', 'SV', 'IP', 'AB', 'BB']
        
        for stat in priority:
            if stat in row_dict and str(row_dict[stat]).strip() not in ["0", "0.0", "None", ""]:
                hero_stats.append({"label": stat, "value": str(row_dict[stat])})
                if len(hero_stats) == 4:
                    break
                    
        # Fallback if no priority stats are found
        if not hero_stats:
            for col, val in row_dict.items():
                if col not in ['PLAYER', 'TEAM', 'SEASON', 'DATE', 'OPP', ''] and str(val).replace('.','',1).isdigit():
                    hero_stats.append({"label": col, "value": str(val)})
                    if len(hero_stats) == 4:
                        break

    primary_image = None
    secondary_image = None
    subject_name = None
    primary_id = None
    subject_type = None
    recent_games = None

    # If the SQL grabbed an athlete_id for the first row, use that!
    if 'athlete_id' in raw_rows[0] and raw_rows[0]['athlete_id'] is not None:
        primary_id = raw_rows[0]['athlete_id']
        subject_type = 'player'
    elif 'team_id' in raw_rows[0] and raw_rows[0]['team_id'] is not None:
        primary_id = raw_rows[0]['team_id']
        subject_type = 'team'

    if subject_type == 'player':
        if primary_id:
            primary_image = f"https://a.espncdn.com/i/headshots/mlb/players/full/{primary_id}.png"
            
            # Fetch recent games if we are on an aggregate row
            if hero_stats and not is_gamelog:
                try:
                    # Guess if pitcher or batter based on what was returned in the aggregate
                    is_pitcher_agg = any(col in columns for col in ['ip', 'p_k', 'p_bb', 'sv', 'era'])
                    
                    if is_pitcher_agg:
                        rg_query = f"""
                            SELECT e.event_id, e.date AS date, t_player.abbreviation AS team_abbr, c_player.home_away, t_opp.abbreviation AS opponent_abbr, p.ip, p.h, p.r, p.er, p.bb, p.k
                            FROM event_boxscores_pitching p 
                            JOIN events e ON p.event_id = e.event_id 
                            JOIN season_teams t_player ON p.team_id = t_player.team_id AND e.season_year = t_player.season_year 
                            JOIN event_competitors c_player ON p.event_id = c_player.event_id AND p.team_id = c_player.team_id 
                            JOIN event_competitors c_opp ON p.event_id = c_opp.event_id AND p.team_id != c_opp.team_id 
                            JOIN season_teams t_opp ON c_opp.team_id = t_opp.team_id AND e.season_year = t_opp.season_year 
                            WHERE p.athlete_id = {primary_id}
                            ORDER BY e.date DESC LIMIT 5;
                        """
                        rg_cols_ui = ["DATE", "TEAM", "", "OPP", "IP", "H", "R", "ER", "BB", "K"]
                        rg_cols_db = ["date", "team_abbr", "home_away", "opponent_abbr", "ip", "h", "r", "er", "bb", "k"]
                    else:
                        rg_query = f"""
                            SELECT e.event_id, e.date AS date, t_player.abbreviation AS team_abbr, c_player.home_away, t_opp.abbreviation AS opponent_abbr, b.ab, b.r, b.h, b.hr, b.rbi, b.bb, b.k, b.sb 
                            FROM event_boxscores_batting b 
                            JOIN events e ON b.event_id = e.event_id 
                            JOIN season_teams t_player ON b.team_id = t_player.team_id AND e.season_year = t_player.season_year 
                            JOIN event_competitors c_player ON b.event_id = c_player.event_id AND b.team_id = c_player.team_id 
                            JOIN event_competitors c_opp ON b.event_id = c_opp.event_id AND b.team_id != c_opp.team_id 
                            JOIN season_teams t_opp ON c_opp.team_id = t_opp.team_id AND e.season_year = t_opp.season_year 
                            WHERE b.athlete_id = {primary_id}
                            ORDER BY e.date DESC LIMIT 5;
                        """
                        rg_cols_ui = ["DATE", "TEAM", "", "OPP", "AB", "R", "H", "HR", "RBI", "BB", "K", "SB"]
                        rg_cols_db = ["date", "team_abbr", "home_away", "opponent_abbr", "ab", "r", "h", "hr", "rbi", "bb", "k", "sb"]
                        
                    rg_results = await database.fetch_all(query=rg_query)
                    
                    if rg_results:
                        rg_rows = []
                        rg_links = []
                        import datetime
                        
                        for row in rg_results:
                            r_dict = dict(row)
                            rg_links.append(f"/games/{r_dict['event_id']}")
                            formatted_r = []
                            for col in rg_cols_db:
                                val = r_dict.get(col)
                                if col == 'home_away':
                                    formatted_r.append('vs' if str(val).lower() == 'home' else '@')
                                elif col == 'date' and val:
                                    try:
                                        if isinstance(val, str):
                                            dt = datetime.datetime.fromisoformat(val.replace('Z', '+00:00'))
                                            formatted_r.append(dt.strftime('%m/%d/%Y'))
                                        else:
                                            formatted_r.append(val.strftime('%m/%d/%Y'))
                                    except Exception:
                                        formatted_r.append(str(val))
                                else:
                                    formatted_r.append(str(val) if val is not None else "0")
                            rg_rows.append(formatted_r)
                            
                        recent_games = {
                            "columns": rg_cols_ui,
                            "rows": rg_rows,
                            "rowLinks": rg_links
                        }
                except Exception as e:
                    logger.error(f"Failed to fetch recent games for {primary_id}: {e}")
                    
        if 'team_abbr' in raw_rows[0] and raw_rows[0]['team_abbr']:
            secondary_image = f"https://a.espncdn.com/i/teamlogos/mlb/500/{str(raw_rows[0]['team_abbr']).lower()}.png"
        elif 'team_id' in raw_rows[0] and raw_rows[0]['team_id']:
            secondary_image = f"https://a.espncdn.com/i/teamlogos/mlb/500/{raw_rows[0]['team_id']}.png"
            
        subject_name = raw_rows[0].get('display_name') or raw_rows[0].get('full_name') or q.lower().replace("gamelog", "").replace("game log", "").strip().title()
    elif subject_type == 'team':
        if primary_id:
            abbrev = raw_rows[0].get('abbreviation', 'mlb')
            primary_image = f"https://a.espncdn.com/i/teamlogos/mlb/500/{str(abbrev).lower()}.png"
        subject_name = raw_rows[0].get('name') or raw_rows[0].get('display_name') or q.lower().replace("gamelog", "").replace("game log", "").strip().title()
    else:
        subject_name = q.lower().replace("gamelog", "").replace("game log", "").strip().title()

    # Simple dynamic answer text
    answer_text = f"Here are the stats you requested."
    
    # Determine the "type" of question to generate a better static answer
    q_lower = q.lower()
    
    if subject_name:
        if "most" in q_lower or "highest" in q_lower or "leader" in q_lower or "top" in q_lower:
            answer_text = f"{subject_name} leads this category."
        elif "gamelog" in q_lower or "game log" in q_lower:
            answer_text = f"{subject_name} game log."
        else:
            answer_text = f"{subject_name} stats."

    return {
        "query": q,
        "answerText": answer_text,
        "primaryImage": primary_image,
        "secondaryImage": secondary_image,
        "primaryImageAlt": subject_name,
        "subjectName": subject_name,
        "subjectType": subject_type,
        "subjectId": primary_id,
        "columns": upper_columns,
        "rows": formatted_rows,
        "rowLinks": row_links,
        "relatedQueries": related_queries,
        "primaryColumnIndex": primary_col_index,
        "heroStats": hero_stats,
        "recentGames": recent_games
    }

