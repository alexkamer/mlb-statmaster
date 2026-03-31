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
        SELECT team_id, location, name, display_name, abbreviation, color, alternate_color, group_id
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


@app.get("/api/teams/{team_id}/espn_data")
async def get_team_espn_data(team_id: int):
    """Fetch the team's next scheduled game, records, and standing summary directly from ESPN."""
    import httpx
    url = f"https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/{team_id}"
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url)
            if resp.status_code != 200:
                return {}
                
            data = resp.json()
            team_data = data.get('team', {})
            
            # 1. Standing Summary
            standing_summary = team_data.get('standingSummary', '')
            
            # 2. Records
            record_data = team_data.get('record', {})
            records = record_data.get('items', []) if isinstance(record_data, dict) else []
            
            # 3. Next Game
            next_events = team_data.get('nextEvent', [])
            next_game_dict = None
            if next_events:
                game = next_events[0]
                comp = game.get('competitions', [{}])[0]
                
                opponent = None
                is_home = False
                for t in comp.get('competitors', []):
                    if str(t.get('id')) != str(team_id):
                        opponent = t.get('team', {})
                    else:
                        is_home = t.get('homeAway') == 'home'
                        
                if opponent:
                    next_game_dict = {
                        "event_id": game.get('id'),
                        "date": game.get('date'),
                        "name": game.get('name'),
                        "short_name": game.get('shortName'),
                        "season_type": game.get('seasonType', {}).get('name'),
                        "opponent_id": opponent.get('id'),
                        "opponent_name": opponent.get('displayName'),
                        "opponent_abbreviation": opponent.get('abbreviation'),
                        "opponent_logo": f"https://a.espncdn.com/i/teamlogos/mlb/500/{opponent.get('abbreviation', 'mlb').lower()}.png",
                        "is_home": is_home,
                        "venue_name": comp.get('venue', {}).get('fullName')
                    }
                    
            return {
                "next_game": next_game_dict,
                "standingSummary": standing_summary,
                "records": records
            }
        except Exception as e:
            print(f"Error fetching espn data: {e}")
            return {}


@app.get("/api/teams/{team_id}/depthchart")
async def get_team_depthchart(team_id: int):
    """Fetch the team's current depth chart to populate the Diamond Architecture."""
    import httpx
    
    # We query the current UTC year to ensure we get the live depth chart
    from datetime import datetime, timezone
    year = datetime.now(timezone.utc).year
    
    url = f"https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/{year}/teams/{team_id}/depthcharts"
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url)
            if resp.status_code != 200:
                # Fallback to the previous year if the current year depth chart hasn't been published yet (e.g. early Spring Training)
                url = f"https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/{year-1}/teams/{team_id}/depthcharts"
                resp = await client.get(url)
                if resp.status_code != 200:
                    return {}
                
            data = resp.json()
            if not data.get('items'):
                return {}
                
            positions_data = data['items'][0].get('positions', {})
            
            diamond = {}
            
            # Map ESPN's position keys to the specific players who are rank 1 (Starters)
            for pos_key, pos_info in positions_data.items():
                athletes = pos_info.get('athletes', [])
                if not athletes:
                    continue
                    
                # We only want the starter (rank = 1)
                starter = next((a for a in athletes if a.get('rank') == 1), athletes[0])
                
                athlete_ref = starter.get('athlete', {}).get('$ref', '')
                if not athlete_ref:
                    continue
                    
                athlete_id = athlete_ref.split('/athletes/')[1].split('?')[0]
                
                # Fetch the athlete's name from our own DB so we don't have to hit 9 ESPN endpoints sequentially!
                athlete_query = "SELECT full_name, display_name FROM athletes WHERE athlete_id = :id"
                athlete_record = await database.fetch_one(query=athlete_query, values={"id": int(athlete_id)})
                
                name = athlete_record['display_name'] if athlete_record else "Unknown Player"
                
                diamond[pos_info.get('position', {}).get('abbreviation')] = {
                    "athlete_id": athlete_id,
                    "name": name,
                    "headshot": f"https://a.espncdn.com/i/headshots/mlb/players/full/{athlete_id}.png"
                }
                
            return diamond
        except Exception as e:
            print(f"Error fetching depth chart: {e}")
            return {}


@app.get("/api/teams/{team_id}/leaders")
async def get_team_leaders(team_id: int, year: int = 2024, season_type: str = "Regular Season"):
    """Fetch official team leaders directly from ESPN and map to our database."""
    import httpx
    
    # Map our readable string back to ESPN's internal type IDs
    type_id = "2"
    if season_type == "Preseason": type_id = "1"
    elif season_type == "Postseason": type_id = "3"
    
    url = f"https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/{year}/types/{type_id}/teams/{team_id}/leaders"
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url)
            if resp.status_code != 200:
                return []
                
            data = resp.json()
            
            # We want to pull specific categories to make a clean dashboard:
            # e.g. Batting Average, Home Runs, ERA, Strikeouts
            desired_categories = ['battingAverage', 'homeRuns', 'runsBattedIn', 'earnedRunAverage', 'strikeouts']
            
            final_leaders = []
            
            for category in data.get('categories', []):
                cat_name = category.get('name')
                if cat_name not in desired_categories:
                    continue
                    
                leaders_list = category.get('leaders', [])
                if not leaders_list:
                    continue
                
                # We only take the #1 leader for each category for a clean UI
                top_leader = leaders_list[0]
                athlete_ref = top_leader.get('athlete', {}).get('$ref', '')
                if not athlete_ref:
                    continue
                    
                athlete_id = int(athlete_ref.split('/athletes/')[1].split('?')[0])
                
                # Get their name from our DB
                athlete_query = "SELECT display_name, position_id FROM athletes WHERE athlete_id = :id"
                athlete_record = await database.fetch_one(query=athlete_query, values={"id": athlete_id})
                
                pos_abbrev = "UN"
                if athlete_record and athlete_record['position_id']:
                    pos_query = "SELECT abbreviation FROM positions WHERE position_id = :pid"
                    pos_record = await database.fetch_one(query=pos_query, values={"pid": athlete_record['position_id']})
                    if pos_record:
                        pos_abbrev = pos_record['abbreviation']
                
                final_leaders.append({
                    "category": category.get('displayName'),
                    "short_category": category.get('abbreviation'),
                    "athlete_id": athlete_id,
                    "name": athlete_record['display_name'] if athlete_record else "Unknown",
                    "position": pos_abbrev,
                    "value": top_leader.get('displayValue'),
                    "headshot": f"https://a.espncdn.com/i/headshots/mlb/players/full/{athlete_id}.png"
                })
                
            return final_leaders
        except Exception as e:
            print(f"Error fetching team leaders: {e}")
            return []


@app.get("/api/teams/{team_id}/standing")
async def get_team_standing(team_id: int, year: int = 2024):
    """Fetch the team's official win/loss record and division rank using the Core API."""
    import httpx
    
    # First, we need to look up the team's Division ID and Name from our DB
    group_query = """
        SELECT st.group_id, g.name as division_name 
        FROM season_teams st
        JOIN groups g ON st.group_id = g.group_id AND st.season_year = g.season_year
        WHERE st.team_id = :team_id AND st.season_year = :year
    """
    team_record = await database.fetch_one(query=group_query, values={"team_id": team_id, "year": year})
    
    if not team_record or not team_record['group_id']:
        return None
        
    group_id = team_record['group_id']
    division_name = team_record['division_name']
    
    # We query the exact division standings endpoint
    url = f"https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/seasons/{year}/types/2/groups/{group_id}/standings/0?lang=en&region=us"
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None
                
            data = resp.json()
            
            # The teams in the division are sorted by rank in the standings array!
            for idx, team_standing in enumerate(data.get('standings', [])):
                # ESPN links the team as a $ref, e.g. ".../teams/10?lang=en&region=us"
                t_ref = team_standing.get('team', {}).get('$ref', '')
                if not t_ref: continue
                
                t_id = t_ref.split('/teams/')[1].split('?')[0]
                
                if str(t_id) == str(team_id):
                    # We found our team! Now find their "overall" record block
                    for record in team_standing.get('records', []):
                        if record.get('name') == 'overall':
                            stats = {s['name']: s['displayValue'] for s in record.get('stats', [])}
                            
                            return {
                                "wins": stats.get('wins', '0'),
                                "losses": stats.get('losses', '0'),
                                "win_percent": stats.get('winPercent', '.000'),
                                "division_rank": idx + 1, # The index in the array is their rank!
                                "division_name": division_name,
                                "games_behind": stats.get('gamesBehind', '0'),
                                "streak": stats.get('streak', 'None')
                            }
            return None
        except Exception as e:
            print(f"Error fetching core standings: {e}")
            return None
        except Exception as e:
            print(f"Error fetching standings: {e}")
            return None


@app.get("/api/players/{player_id}")
async def get_player_profile(player_id: int):
    """Get the player's biographical data, current team, and historical stats."""
    
    # 1. Fetch biographical info and current team
    bio_query = """
        SELECT 
            a.athlete_id,
            a.first_name,
            a.last_name,
            a.display_name,
            a.weight,
            a.height,
            a.age,
            a.bats,
            a.throws,
            a.is_active,
            p.name as position_name,
            p.abbreviation as position_abbreviation,
            'https://a.espncdn.com/i/headshots/mlb/players/full/' || a.athlete_id || '.png' as headshot,
            (
                SELECT st.display_name
                FROM season_rosters sr
                JOIN season_teams st ON sr.season_team_id = st.season_team_id
                WHERE sr.athlete_id = a.athlete_id
                ORDER BY sr.season_year DESC
                LIMIT 1
            ) as team_name,
            (
                SELECT st.abbreviation
                FROM season_rosters sr
                JOIN season_teams st ON sr.season_team_id = st.season_team_id
                WHERE sr.athlete_id = a.athlete_id
                ORDER BY sr.season_year DESC
                LIMIT 1
            ) as team_abbreviation,
            (
                SELECT st.color
                FROM season_rosters sr
                JOIN season_teams st ON sr.season_team_id = st.season_team_id
                WHERE sr.athlete_id = a.athlete_id
                ORDER BY sr.season_year DESC
                LIMIT 1
            ) as team_color,
            (
                SELECT st.alternate_color
                FROM season_rosters sr
                JOIN season_teams st ON sr.season_team_id = st.season_team_id
                WHERE sr.athlete_id = a.athlete_id
                ORDER BY sr.season_year DESC
                LIMIT 1
            ) as team_alternate_color
        FROM athletes a
        LEFT JOIN positions p ON a.position_id = p.position_id
        WHERE a.athlete_id = :player_id
    """
    player_bio = await database.fetch_one(query=bio_query, values={"player_id": player_id})
    
    if not player_bio:
        raise HTTPException(status_code=404, detail="Player not found")
        
    # 1.5 Fetch Historical Team Mappings
    teams_query = """
        SELECT 
            season_year,
            STRING_AGG(DISTINCT team_abbreviation, '/') as team_abbreviation
        FROM (
            SELECT DISTINCT
                e.season_year,
                t.abbreviation as team_abbreviation
            FROM event_boxscores_batting b
            JOIN events e ON b.event_id = e.event_id
            JOIN season_teams t ON b.team_id = t.team_id AND e.season_year = t.season_year
            WHERE b.athlete_id = :player_id AND t.abbreviation IS NOT NULL
            UNION
            SELECT DISTINCT
                e.season_year,
                t.abbreviation as team_abbreviation
            FROM event_boxscores_pitching p
            JOIN events e ON p.event_id = e.event_id
            JOIN season_teams t ON p.team_id = t.team_id AND e.season_year = t.season_year
            WHERE p.athlete_id = :player_id AND t.abbreviation IS NOT NULL
        ) as sub
        GROUP BY season_year
    """
    historical_teams = await database.fetch_all(query=teams_query, values={"player_id": player_id})
    team_history = {row["season_year"]: row["team_abbreviation"] for row in historical_teams}
        
    # 2. Fetch historical batting stats season-by-season (Regular Season only)
    stats_query = """
        SELECT 
            e.season_year,
            t.abbreviation as team_abbreviation,
            COUNT(DISTINCT b.event_id) as g,
            SUM(b.ab) as ab,
            SUM(b.r) as r,
            SUM(b.h) as h,
            SUM(b.hr) as hr,
            SUM(b.rbi) as rbi,
            SUM(b.bb) as bb,
            SUM(b.k) as k,
            ROUND(SUM(b.h)::numeric / NULLIF(SUM(b.ab), 0), 3) as avg,
            ROUND((SUM(b.h) + SUM(b.bb))::numeric / NULLIF(SUM(b.ab) + SUM(b.bb), 0), 3) as obp,
            ROUND((SUM(b.h) + (SUM(b.hr) * 3))::numeric / NULLIF(SUM(b.ab), 0), 3) as slg,
            ROUND(
                ((SUM(b.h) + SUM(b.bb))::numeric / NULLIF(SUM(b.ab) + SUM(b.bb), 0)) + 
                ((SUM(b.h) + (SUM(b.hr) * 3))::numeric / NULLIF(SUM(b.ab), 0)), 
            3) as ops
        FROM event_boxscores_batting b
        JOIN events e ON b.event_id = e.event_id
        LEFT JOIN season_types st ON e.season_year = st.season_year AND e.date >= st.start_date AND e.date <= st.end_date
        LEFT JOIN season_teams t ON b.team_id = t.team_id AND e.season_year = t.season_year
        WHERE b.athlete_id = :player_id AND st.type_id = 2
        GROUP BY e.season_year, t.abbreviation
        ORDER BY e.season_year DESC
    """
    
    historical_stats = await database.fetch_all(query=stats_query, values={"player_id": player_id})
    
    return {
        "bio": dict(player_bio),
        "stats": [dict(s) for s in historical_stats],
        "team_history": team_history
    }



@app.get("/api/players/{player_id}/gamelog")
async def get_player_gamelog(player_id: int, year: int = 2024):
    """Get a player's game-by-game logs for a specific season."""
    
    # We will query both batting and pitching events for the player
    # Since a player can pitch and hit in the same game, we use an outer join pattern or two queries
    # For simplicity and performance, we will grab batting and pitching separately and merge them.
    
    batting_query = """
        SELECT 
            st.type_id as season_type,
            e.event_id,
            e.date,
            e.short_name,
            b.team_id,
            b.starter,
            b.ab,
            b.r,
            b.h,
            b.hr,
            b.rbi,
            b.bb,
            b.k,
            b.pitches_faced,
            (SELECT c.score FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id = b.team_id) as team_score,
            (SELECT c.score FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id != b.team_id) as opponent_score,
            (SELECT c.winner FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id = b.team_id) as is_win,
            (SELECT t.abbreviation FROM event_competitors c JOIN season_teams t ON c.season_team_id = t.season_team_id WHERE c.event_id = e.event_id AND c.team_id != b.team_id) as opponent_abbrev,
            (SELECT c.team_id FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id != b.team_id) as opponent_id,
            (SELECT c.home_away FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id = b.team_id) as home_away
        FROM event_boxscores_batting b
        JOIN events e ON b.event_id = e.event_id
        LEFT JOIN season_types st ON e.season_year = st.season_year AND e.date >= st.start_date AND e.date <= st.end_date
        WHERE b.athlete_id = :player_id AND e.season_year = :year AND st.type_id IN (2, 3) -- Only Regular Season & Postseason
        ORDER BY e.date DESC
    """
    
    pitching_query = """
        SELECT 
            st.type_id as season_type,
            e.event_id,
            e.date,
            e.short_name,
            p.team_id,
            p.starter,
            p.ip,
            p.h,
            p.r,
            p.er,
            p.hr,
            p.bb,
            p.k,
            p.pitches,
            (SELECT c.score FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id = p.team_id) as team_score,
            (SELECT c.score FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id != p.team_id) as opponent_score,
            (SELECT c.winner FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id = p.team_id) as is_win,
            (SELECT t.abbreviation FROM event_competitors c JOIN season_teams t ON c.season_team_id = t.season_team_id WHERE c.event_id = e.event_id AND c.team_id != p.team_id) as opponent_abbrev,
            (SELECT c.team_id FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id != p.team_id) as opponent_id,
            (SELECT c.home_away FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id = p.team_id) as home_away
        FROM event_boxscores_pitching p
        JOIN events e ON p.event_id = e.event_id
        LEFT JOIN season_types st ON e.season_year = st.season_year AND e.date >= st.start_date AND e.date <= st.end_date
        WHERE p.athlete_id = :player_id AND e.season_year = :year AND st.type_id IN (2, 3) -- Only Regular Season & Postseason
        ORDER BY e.date DESC
    """
    
    try:
        batting_logs = await database.fetch_all(query=batting_query, values={"player_id": player_id, "year": year})
        pitching_logs = await database.fetch_all(query=pitching_query, values={"player_id": player_id, "year": year})
        
        return {
            "batting": [dict(b) for b in batting_logs],
            "pitching": [dict(p) for p in pitching_logs]
        }
    except Exception as e:
        print(f"Error fetching gamelogs: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch game logs")


@app.get("/api/stats/league")
async def get_league_stats(year: int = 2024, type: str = "batting", season_type: str = "Regular Season", limit: int = 100):
    """Get aggregated league-wide player statistics for a specific season."""
    
    type_id_map = {
        "Preseason": 1,
        "Regular Season": 2,
        "Postseason": 3,
        "All": None
    }
    type_id = type_id_map.get(season_type, 2)
    type_filter = f" AND st.type_id = {type_id}" if type_id else ""
    
    if type == "batting":
        query = f"""
            SELECT 
                b.athlete_id,
                MAX(p.display_name) as name,
                
                MAX(t.abbreviation) as team_abbrev,
                MAX(t.color) as team_color,
                MAX(b.team_id) as team_id,
                COUNT(b.event_id) as g,
                SUM(b.ab) as ab,
                SUM(b.r) as r,
                SUM(b.h) as h,
                SUM(b.hr) as hr,
                SUM(b.rbi) as rbi,
                SUM(b.bb) as bb,
                SUM(b.k) as k,
                CASE WHEN SUM(b.ab) > 0 THEN ROUND((SUM(b.h)::numeric / SUM(b.ab)), 3) ELSE 0 END as avg,
                CASE WHEN SUM(b.ab + b.bb) > 0 THEN ROUND(((SUM(b.h) + SUM(b.bb))::numeric / SUM(b.ab + b.bb)), 3) ELSE 0 END as obp,
                CASE WHEN SUM(b.ab) > 0 THEN ROUND(((SUM(b.h) + SUM(b.hr)*3)::numeric / SUM(b.ab)), 3) ELSE 0 END as slg,
                (CASE WHEN SUM(b.ab + b.bb) > 0 THEN ROUND(((SUM(b.h) + SUM(b.bb))::numeric / SUM(b.ab + b.bb)), 3) ELSE 0 END + 
                 CASE WHEN SUM(b.ab) > 0 THEN ROUND(((SUM(b.h) + SUM(b.hr)*3)::numeric / SUM(b.ab)), 3) ELSE 0 END) as ops
            FROM event_boxscores_batting b
            JOIN events e ON b.event_id = e.event_id
            JOIN athletes p ON b.athlete_id = p.athlete_id
            JOIN season_teams t ON b.team_id = t.team_id AND e.season_year = t.season_year
            LEFT JOIN season_types st ON e.season_year = st.season_year AND e.date >= st.start_date AND e.date <= st.end_date
            WHERE e.season_year = :year {type_filter} AND b.ab IS NOT NULL
            GROUP BY b.athlete_id
            HAVING SUM(b.ab) > 0
            ORDER BY ops DESC, hr DESC
            LIMIT :limit
        """
    else:
        query = f"""
            SELECT 
                p_box.athlete_id,
                MAX(p.display_name) as name,
                
                MAX(t.abbreviation) as team_abbrev,
                MAX(t.color) as team_color,
                MAX(p_box.team_id) as team_id,
                COUNT(p_box.event_id) as g,
                SUM(NULLIF(p_box.ip, '--.--')::numeric) as ip,
                SUM(p_box.h) as h,
                SUM(p_box.r) as r,
                SUM(p_box.er) as er,
                SUM(p_box.hr) as hr,
                SUM(p_box.bb) as bb,
                SUM(p_box.k) as k,
                SUM(CASE WHEN c.winner = true AND c.team_id = p_box.team_id THEN 1 ELSE 0 END) as w,
                SUM(CASE WHEN c.winner = false AND c.team_id = p_box.team_id THEN 1 ELSE 0 END) as l,
                CASE WHEN SUM(NULLIF(p_box.ip, '--.--')::numeric) > 0 THEN ROUND((SUM(p_box.er)::numeric * 9 / SUM(NULLIF(p_box.ip, '--.--')::numeric)), 2) ELSE 0 END as era,
                CASE WHEN SUM(NULLIF(p_box.ip, '--.--')::numeric) > 0 THEN ROUND(((SUM(p_box.bb) + SUM(p_box.h))::numeric / SUM(NULLIF(p_box.ip, '--.--')::numeric)), 2) ELSE 0 END as whip
            FROM event_boxscores_pitching p_box
            JOIN events e ON p_box.event_id = e.event_id
            JOIN athletes p ON p_box.athlete_id = p.athlete_id
            JOIN season_teams t ON p_box.team_id = t.team_id AND e.season_year = t.season_year
            LEFT JOIN event_competitors c ON p_box.event_id = c.event_id AND p_box.team_id = c.team_id
            LEFT JOIN season_types st ON e.season_year = st.season_year AND e.date >= st.start_date AND e.date <= st.end_date
            WHERE e.season_year = :year {type_filter} AND p_box.ip IS NOT NULL AND p_box.ip != '--.--'
            GROUP BY p_box.athlete_id
            HAVING SUM(NULLIF(p_box.ip, '--.--')::numeric) > 0
            ORDER BY era ASC, k DESC
            LIMIT :limit
        """

    try:
        stats = await database.fetch_all(query=query, values={"year": year, "limit": limit})
        return [dict(s) for s in stats]
    except Exception as e:
        print(f"Error fetching league stats: {e}")
        return []

@app.get("/api/props/{date}")
async def get_daily_props(date: str):
    """Get all saved player props for a specific date (YYYYMMDD)."""
    try:
        # Fetch the games for that date to filter the props
        import httpx
        url = f"https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates={date}"
        async with httpx.AsyncClient() as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return []
            data = resp.json()
            event_ids = [int(event["id"]) for event in data.get("events", [])]
            
        if not event_ids:
            return []

        query = """
            SELECT 
                id, event_id, athlete_id, prop_type, prop_line, over_odds, under_odds, last_updated
            FROM player_props
            WHERE event_id = ANY(:event_ids)
        """
        
        props = await database.fetch_all(query=query, values={"event_ids": event_ids})
        return [dict(p) for p in props]
    except Exception as e:
        print(f"Error fetching props: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch props")
