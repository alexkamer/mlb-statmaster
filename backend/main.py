from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import databases
import sqlalchemy
import asyncio

DATABASE_URL = "postgresql:///mlb_db"

database = databases.Database(DATABASE_URL)
metadata = sqlalchemy.MetaData()

app = FastAPI(title="MLB Statmaster API")

# Allow the React frontend to make requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
async def get_recent_games(team_id: int, limit: int = 5, year: int = 2024, season_type_id: int = None):
    """Get the recent results for a team, optionally filtered by year and season type."""
    try:
        where_clause = "WHERE c1.score IS NOT NULL"
        query_params = {"team_id": team_id, "limit": limit}

        if season_type_id:
            where_clause += " AND st.type_id = :season_type_id"
            query_params["season_type_id"] = season_type_id
        else:
            where_clause += " AND e.season_year = :year"
            query_params["year"] = year

        query = f"""
            SELECT
                e.event_id,
                e.date,
                e.name as matchup,
                c1.score as team_score,
                c2.score as opponent_score,
                c2.team_id as opponent_id,
                c1.winner,
                (SELECT st_inner.name FROM season_types st_inner WHERE e.season_year = st_inner.season_year AND e.date >= st_inner.start_date AND e.date <= st_inner.end_date LIMIT 1) as season_type_name,
                (SELECT st_inner.type_id FROM season_types st_inner WHERE e.season_year = st_inner.season_year AND e.date >= st_inner.start_date AND e.date <= st_inner.end_date LIMIT 1) as season_type_id,
                (SELECT t.abbreviation FROM season_teams t WHERE t.team_id = c2.team_id AND t.season_year = e.season_year LIMIT 1) as opponent_abbreviation,
                c1.home_away as location
            FROM events e
            JOIN event_competitors c1 ON e.event_id = c1.event_id AND c1.team_id = :team_id
            JOIN event_competitors c2 ON e.event_id = c2.event_id AND c2.team_id != :team_id
            LEFT JOIN season_types st ON e.season_year = st.season_year AND e.date >= st.start_date AND e.date <= st.end_date
            {where_clause}
            ORDER BY e.date DESC
            LIMIT :limit
        """
        results = await database.fetch_all(query=query, values=query_params)
        return [dict(r) for r in results]
    except Exception as e:
        print(f"Error in get_recent_games: {e}")
        raise HTTPException(status_code=500, detail=str(e))
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



@app.get("/api/teams/{team_id}/opponents/starters")
async def get_team_opponent_starters(team_id: int, year: int = 2024, limit: int = 50):
    """Get the recent starting pitchers that have played against this team."""
    query = """
        SELECT 
            p.athlete_id, a.display_name as pitcher_name,
            e.date,
            e.event_id,
            t.abbreviation as pitcher_team,
            p.team_id as pitcher_team_id,
            c1.home_away as opponent_home_away,
            p.ip, p.h, p.r, p.er, p.bb, p.k, p.hr, p.pitches
        FROM event_boxscores_pitching p
        JOIN events e ON p.event_id = e.event_id
        JOIN athletes a ON p.athlete_id = a.athlete_id
        JOIN event_competitors c1 ON e.event_id = c1.event_id AND c1.team_id = :team_id
        JOIN season_teams t ON p.team_id = t.team_id AND t.season_year = :year
        LEFT JOIN season_types st ON e.season_year = st.season_year AND e.date >= st.start_date AND e.date <= st.end_date
        WHERE p.team_id != :team_id AND p.starter = true AND e.season_year = :year AND st.type_id IN (2, 3)
        ORDER BY e.date DESC
        LIMIT :limit
    """
    return await database.fetch_all(query=query, values={"team_id": team_id, "year": year, "limit": limit})

@app.get("/api/teams/{team_id}/opponents/batters")
async def get_team_opponent_batters(team_id: int, year: int = 2024, limit: int = 400):
    """Get the recent starting batters that have played against this team."""
    query = """
        SELECT 
            b.athlete_id, a.display_name as batter_name,
            e.date,
            e.event_id,
            t.abbreviation as batter_team,
            b.team_id as batter_team_id,
            pos.abbreviation as position,
            c1.home_away as opponent_home_away,
            b.ab, b.r, b.h, b.rbi, b.hr, b.bb, b.k, b.sb, COALESCE(b.d, 0) as d, COALESCE(b.t, 0) as t,
            b.pitches_faced,
            (COALESCE(b.h, 0) - COALESCE(b.d, 0) - COALESCE(b.t, 0) - COALESCE(b.hr, 0)) as singles
        FROM event_boxscores_batting b
        JOIN events e ON b.event_id = e.event_id
        JOIN athletes a ON b.athlete_id = a.athlete_id
        JOIN event_competitors c1 ON e.event_id = c1.event_id AND c1.team_id = :team_id
        JOIN season_teams t ON b.team_id = t.team_id AND t.season_year = :year
        LEFT JOIN positions pos ON b.position_id = pos.position_id
        LEFT JOIN season_types st ON e.season_year = st.season_year AND e.date >= st.start_date AND e.date <= st.end_date
        WHERE b.team_id != :team_id AND b.starter = true AND e.season_year = :year AND st.type_id IN (2, 3)
        ORDER BY e.date DESC
        LIMIT :limit
    """
    return await database.fetch_all(query=query, values={"team_id": team_id, "year": year, "limit": limit})


@app.get("/api/teams/{team_id}/splits/batting")
async def get_team_batting_splits_by_outs(team_id: int, outs: int = 15, year: int = 2024):
    """Get team batting logs strictly up to a certain number of outs in each game."""
    query = """
        SELECT e.event_id, e.date, c1.home_away, c2.team_id as opp_team, p.inning, p.play_type_text, p.text,
        (SELECT t.abbreviation FROM season_teams t WHERE t.team_id = c2.team_id AND t.season_year = e.season_year LIMIT 1) as opp_abbrev
        FROM event_plays p
        JOIN events e ON p.event_id = e.event_id
        JOIN event_competitors c1 ON e.event_id = c1.event_id AND c1.team_id = :team_id
        JOIN event_competitors c2 ON e.event_id = c2.event_id AND c2.team_id != :team_id
        LEFT JOIN season_types st ON e.season_year = st.season_year AND e.date >= st.start_date AND e.date <= st.end_date
        WHERE e.season_year = :year AND p.play_type_text IN ('Start Inning', 'Play Result')
        AND st.type_id IN (2, 3)
        ORDER BY e.event_id, p.play_id ASC
    """
    plays = await database.fetch_all(query=query, values={"team_id": team_id, "year": year})
    
    games_stats = {}
    current_batting = False
    
    for p in plays:
        eid = p['event_id']
        if eid not in games_stats:
            games_stats[eid] = {
                'event_id': eid,
                'date': p['date'],
                'opp_id': p['opp_team'],
                'opp_abbrev': p['opp_abbrev'],
                'home_away': p['home_away'],
                'outs': 0, 'ab': 0, 'h': 0, 'hr': 0, 'r': 0, 'bb': 0, 'k': 0, 'singles': 0, 'doubles': 0, 'triples': 0,
                'done': False
            }
            
        gs = games_stats[eid]
        if gs['done']: continue
        
        if p['play_type_text'] == 'Start Inning':
            if 'Top of' in p['text']:
                current_batting = (gs['home_away'] == 'away')
            elif 'Bottom of' in p['text']:
                current_batting = (gs['home_away'] == 'home')
            
        if p['play_type_text'] == 'Play Result' and current_batting:
            t = p['text'].lower()
            
            outs_on_play = 0
            if "triple play" in t: outs_on_play = 3
            elif "double play" in t: outs_on_play = 2
            elif any(k in t for k in [" struck out", " flied out", " grounded out", " lined out", " popped out", " fouled out", " caught stealing", " picked off", " out at first", " out at second", " out at third", " out at home", " out on batter's", " interference", " sacrifice fly"]):
                outs_on_play = 1
                
            if " struck out" in t and (" caught stealing" in t or " out at " in t):
                outs_on_play = 2
                
            runs_on_play = t.count(" scored") + (1 if " homered" in t else 0)
            
            k = 1 if " struck out" in t else 0
            bb = 1 if " walked" in t or " intentionally walked" in t else 0
            hr = 1 if " homered" in t else 0
            single = 1 if " singled" in t or "infield single" in t else 0
            double = 1 if " doubled" in t else 0
            triple = 1 if " tripled" in t else 0
            h = hr + single + double + triple
            ab = 1 if (h > 0 or any(k in t for k in [" struck out", " flied out", " grounded out", " lined out", " popped out", " fouled out", " flied into", " grounded into", " lined into", " popped into", " reached on error", " reached on fielder's choice", " reached on catcher's interference"])) else 0
            
            if gs['outs'] < outs:
                gs['outs'] += outs_on_play
                gs['r'] += runs_on_play
                gs['h'] += h
                gs['hr'] += hr
                gs['k'] += k
                gs['bb'] += bb
                gs['singles'] += single
                gs['doubles'] += double
                gs['triples'] += triple
                gs['ab'] += ab
                
                if gs['outs'] >= outs:
                    gs['done'] = True
                    
    # Format and return as list, sorted by date descending
    result_list = list(games_stats.values())
    result_list.sort(key=lambda x: x['date'], reverse=True)
    return result_list

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
            desired_categories = ['avg', 'homeRuns', 'RBIs', 'OPS', 'stolenBases', 'ERA', 'strikeouts', 'wins', 'saves', 'WHIP']
            
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
                if athlete_record and athlete_record['position_id'] is not None:
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




@app.get("/api/players/gamelogs/batch")
async def get_batch_player_gamelogs(player_ids: str, year: int = 2024, limit: int = 15):
    """Get game logs for multiple players at once to prevent connection pooling bottlenecks."""
    try:
        p_ids = [int(p) for p in player_ids.split(",") if p.strip().isdigit()]
        if not p_ids:
            return {}
            
        type_filter = "st.type_id IN (2, 3)"
        
        # We need the last N logs per player. The easiest way without complex window functions in SQLite is:
        # Actually, Postgres supports ROW_NUMBER(). Since we use Postgres:
        
        batting_query = """
            WITH RankedBatting AS (
                SELECT 
                    b.athlete_id,
                    st.type_id as season_type,
                    e.event_id,
                    e.date,
                    e.short_name,
                    b.team_id,
                    b.starter,
                    b.ab, b.r, b.h, b.hr, b.rbi, b.bb, b.k, b.sb, 
                    COALESCE(b.d, 0) as d, COALESCE(b.t, 0) as t,
                    b.pitches_faced,
                    (COALESCE(b.h, 0) - COALESCE(b.d, 0) - COALESCE(b.t, 0) - COALESCE(b.hr, 0)) as singles,
                    (SELECT c.score FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id = b.team_id) as team_score,
                    (SELECT c.score FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id != b.team_id) as opponent_score,
                    (SELECT c.winner FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id = b.team_id) as is_win,
                    (SELECT t.abbreviation FROM event_competitors c JOIN season_teams t ON c.season_team_id = t.season_team_id WHERE c.event_id = e.event_id AND c.team_id != b.team_id) as opponent_abbrev,
                    (SELECT c.team_id FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id != b.team_id) as opponent_id,
                    (SELECT c.home_away FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id = b.team_id) as home_away,
                    ROW_NUMBER() OVER(PARTITION BY b.athlete_id ORDER BY e.date DESC) as rn
                FROM event_boxscores_batting b
                JOIN events e ON b.event_id = e.event_id
                LEFT JOIN season_types st ON e.season_year = st.season_year AND e.date >= st.start_date AND e.date <= st.end_date
                WHERE b.athlete_id = ANY(:p_ids) AND b.starter = true AND __TYPE_FILTER__
            )
            SELECT * FROM RankedBatting WHERE rn <= :limit
        """.replace("__TYPE_FILTER__", type_filter)
        
        pitching_query = """
            WITH RankedPitching AS (
                SELECT 
                    p.athlete_id,
                    st.type_id as season_type,
                    e.event_id,
                    e.date,
                    e.short_name,
                    p.team_id,
                    p.starter,
                    p.ip, p.h, p.r, p.er, p.hr, p.bb, p.k, p.pitches,
                    COALESCE(p.recorded_win, false) as recorded_win,
                    (SELECT c.score FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id = p.team_id) as team_score,
                    (SELECT c.score FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id != p.team_id) as opponent_score,
                    (SELECT c.winner FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id = p.team_id) as is_win,
                    (SELECT t.abbreviation FROM event_competitors c JOIN season_teams t ON c.season_team_id = t.season_team_id WHERE c.event_id = e.event_id AND c.team_id != p.team_id) as opponent_abbrev,
                    (SELECT c.team_id FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id != p.team_id) as opponent_id,
                    (SELECT c.home_away FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id = p.team_id) as home_away,
                    ROW_NUMBER() OVER(PARTITION BY p.athlete_id ORDER BY e.date DESC) as rn
                FROM event_boxscores_pitching p
                JOIN events e ON p.event_id = e.event_id
                LEFT JOIN season_types st ON e.season_year = st.season_year AND e.date >= st.start_date AND e.date <= st.end_date
                WHERE p.athlete_id = ANY(:p_ids) AND p.starter = true AND __TYPE_FILTER__
            )
            SELECT * FROM RankedPitching WHERE rn <= :limit
        """.replace("__TYPE_FILTER__", type_filter)

        batting_logs = await database.fetch_all(query=batting_query, values={"limit": limit, "p_ids": p_ids})
        pitching_logs = await database.fetch_all(query=pitching_query, values={"limit": limit, "p_ids": p_ids})
        
        result_map = {pid: {"batting": [], "pitching": []} for pid in p_ids}
        
        for b in batting_logs:
            d = dict(b)
            d.pop('rn', None)
            result_map[d['athlete_id']]["batting"].append(d)
            
        for p in pitching_logs:
            d = dict(p)
            d.pop('rn', None)
            result_map[d['athlete_id']]["pitching"].append(d)
            
        return result_map
    except Exception as e:
        print(f"Batch Gamlogs Error: {e}")
        return {}

@app.get("/api/players/{player_id}/gamelog")
async def get_player_gamelog(player_id: int, year: int = 2024, limit: int = 15, season_type_id: int = None):
    """Get a player's game-by-game logs for a specific season, or last N games if year is omitted."""
    type_filter = "st.type_id = :season_type_id" if season_type_id else "st.type_id IN (2, 3)"
    
    # We will query both batting and pitching events for the player
    # Since a player can pitch and hit in the same game, we use an outer join pattern or two queries
    # For simplicity and performance, we will grab batting and pitching separately and merge them.
    
    # If a year is passed but we want all-time last N starts, we will ignore the year filter
    
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
            COALESCE(b.d, 0) as d,
            COALESCE(b.t, 0) as t,
            COALESCE(b.sb, 0) as sb,
            (b.h - COALESCE(b.d, 0) - COALESCE(b.t, 0) - b.hr) as singles,
            (SELECT c.score FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id = b.team_id) as team_score,
            (SELECT c.score FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id != b.team_id) as opponent_score,
            (SELECT c.winner FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id = b.team_id) as is_win,
            (SELECT t.abbreviation FROM event_competitors c JOIN season_teams t ON c.season_team_id = t.season_team_id WHERE c.event_id = e.event_id AND c.team_id != b.team_id) as opponent_abbrev,
            (SELECT c.team_id FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id != b.team_id) as opponent_id,
            (SELECT c.home_away FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id = b.team_id) as home_away,
            (SELECT 
                CASE 
                    WHEN ec.home_away = 'home' THEN (SELECT home_money_line FROM event_odds eo WHERE eo.event_id = e.event_id LIMIT 1)
                    ELSE (SELECT away_money_line FROM event_odds eo WHERE eo.event_id = e.event_id LIMIT 1)
                END
             FROM event_competitors ec WHERE ec.event_id = e.event_id AND ec.team_id = b.team_id) as team_money_line,
            (SELECT a.throws FROM event_boxscores_pitching bp JOIN athletes a ON bp.athlete_id = a.athlete_id WHERE bp.event_id = e.event_id AND bp.team_id != b.team_id AND bp.starter = true LIMIT 1) as opp_starter_throws
        FROM event_boxscores_batting b
        JOIN events e ON b.event_id = e.event_id
        LEFT JOIN season_types st ON e.season_year = st.season_year AND e.date >= st.start_date AND e.date <= st.end_date
        WHERE b.athlete_id = :player_id AND b.starter = true AND __TYPE_FILTER__
        ORDER BY e.date DESC
        LIMIT :limit
    """.replace("__TYPE_FILTER__", type_filter)
    
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
            COALESCE(p.recorded_win, false) as recorded_win,
            (SELECT c.score FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id = p.team_id) as team_score,
            (SELECT c.score FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id != p.team_id) as opponent_score,
            (SELECT c.winner FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id = p.team_id) as is_win,
            (SELECT t.abbreviation FROM event_competitors c JOIN season_teams t ON c.season_team_id = t.season_team_id WHERE c.event_id = e.event_id AND c.team_id != p.team_id) as opponent_abbrev,
            (SELECT c.team_id FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id != p.team_id) as opponent_id,
            (SELECT c.home_away FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id = p.team_id) as home_away,
            (SELECT 
                CASE 
                    WHEN ec.home_away = 'home' THEN (SELECT home_money_line FROM event_odds eo WHERE eo.event_id = e.event_id LIMIT 1)
                    ELSE (SELECT away_money_line FROM event_odds eo WHERE eo.event_id = e.event_id LIMIT 1)
                END
             FROM event_competitors ec WHERE ec.event_id = e.event_id AND ec.team_id = p.team_id) as team_money_line,
            (SELECT a.throws FROM event_boxscores_pitching bp JOIN athletes a ON bp.athlete_id = a.athlete_id WHERE bp.event_id = e.event_id AND bp.team_id != p.team_id AND bp.starter = true LIMIT 1) as opp_starter_throws
        FROM event_boxscores_pitching p
        JOIN events e ON p.event_id = e.event_id
        LEFT JOIN season_types st ON e.season_year = st.season_year AND e.date >= st.start_date AND e.date <= st.end_date
        WHERE p.athlete_id = :player_id AND p.starter = true AND __TYPE_FILTER__
        ORDER BY e.date DESC
        LIMIT :limit
    """.replace("__TYPE_FILTER__", type_filter)
    
    try:
        query_params = {"player_id": player_id, "limit": limit}
        if season_type_id:
            query_params["season_type_id"] = season_type_id
            
        batting_logs = await database.fetch_all(query=batting_query, values=query_params)
        pitching_logs = await database.fetch_all(query=pitching_query, values=query_params)
        
        bat_list = [dict(b) for b in batting_logs]
        pit_list = [dict(p) for p in pitching_logs]
        
        return {
            "batting": bat_list,
            "pitching": pit_list
        }
    except Exception as e:
        print(f"Error fetching gamelogs: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch game logs")

@app.get("/api/players/{player_id}/props")
async def get_player_props(player_id: int):
    """Get all unique prop types and their latest lines available for a specific player."""
    query = """
        SELECT prop_type, prop_line
        FROM player_props
        WHERE athlete_id = :player_id
        ORDER BY last_updated DESC
    """
    props = await database.fetch_all(query=query, values={"player_id": player_id})
    
    # Deduplicate keeping most recent
    result = {}
    for p in props:
        if p["prop_type"] not in result:
            result[p["prop_type"]] = p["prop_line"]
            
    return [{"prop_type": k, "prop_line": v} for k, v in result.items()]

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

from typing import Optional

@app.get("/api/props/{date}")
async def get_daily_props(date: str, event_ids: Optional[str] = None):
    """Get all saved player props for a specific date (YYYYMMDD)."""
    try:
        formatted_date = f"{date[0:4]}-{date[4:6]}-{date[6:8]}"
        
        where_clause = "e.date::text LIKE :date_like"
        values = {"date_like": f"{formatted_date}%"}
        
        if event_ids:
            e_ids = [int(eid) for eid in event_ids.split(",") if eid.strip()]
            if e_ids:
                where_clause = "pp.event_id = ANY(:event_ids)"
                values = {"event_ids": e_ids}
        
        query = f"""
            SELECT 
                pp.id, pp.event_id, pp.athlete_id, pp.prop_type, pp.prop_line, pp.over_odds, pp.under_odds, pp.last_updated,
                a.display_name as athlete_name,
                COALESCE(
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
            JOIN events e ON pp.event_id = e.event_id
            WHERE {where_clause}
        """
        props = await database.fetch_all(query=query, values=values)
        return [dict(p) for p in props]
    except Exception as e:
        print(f"Error fetching props: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch props")

@app.get("/api/predictions/context")
async def get_prediction_context(
    event_id: str, 
    away_team_id: int, 
    home_team_id: int, 
    away_starter_id: int = None, 
    home_starter_id: int = None,
    year: int = 2026
):
    """
    Aggregates comprehensive situational data for an upcoming game.
    Designed to provide a structured payload for LLM analysis.
    """
    try:
        async def get_team_context(team_id: int):
            # 1. Season Record & Last 10
            record_query = """
                WITH team_games AS (
                    SELECT 
                        e.date,
                        c1.winner,
                        c1.score as team_score,
                        c2.score as opponent_score
                    FROM events e
                    JOIN event_competitors c1 ON e.event_id = c1.event_id AND c1.team_id = :team_id
                    JOIN event_competitors c2 ON e.event_id = c2.event_id AND c2.team_id != :team_id
                    JOIN season_types st ON e.season_year = st.season_year 
                        AND e.date >= st.start_date AND e.date <= st.end_date
                    WHERE st.type_id = 2 -- Regular Season
                      AND e.season_year = :year
                      AND c1.score IS NOT NULL
                    ORDER BY e.date DESC
                )
                SELECT 
                    COUNT(*) as total_games,
                    SUM(CASE WHEN winner THEN 1 ELSE 0 END) as wins,
                    SUM(CASE WHEN winner THEN 0 ELSE 1 END) as losses,
                    (SELECT string_agg(CASE WHEN winner THEN 'W' ELSE 'L' END, '') FROM (SELECT winner FROM team_games LIMIT 10) t) as l10_streak
                FROM team_games
            """
            
            # 2. Splits vs Handedness
            splits_query = """
                SELECT 
                    a.throws,
                    COUNT(DISTINCT b.event_id) as games,
                    ROUND(AVG(team_total_r), 2) as avg_runs,
                    ROUND(SUM(team_total_h)::numeric / NULLIF(SUM(team_total_ab), 0), 3) as team_avg
                FROM (
                    SELECT 
                        b.event_id,
                        b.team_id,
                        SUM(b.ab) as team_total_ab,
                        SUM(b.h) as team_total_h,
                        SUM(b.r) as team_total_r
                    FROM event_boxscores_batting b
                    GROUP BY b.event_id, b.team_id
                ) b
                JOIN event_boxscores_pitching opp_p ON b.event_id = opp_p.event_id AND b.team_id != opp_p.team_id
                JOIN athletes a ON opp_p.athlete_id = a.athlete_id
                JOIN events e ON b.event_id = e.event_id
                JOIN season_types st ON e.season_year = st.season_year 
                    AND e.date >= st.start_date AND e.date <= st.end_date
                WHERE b.team_id = :team_id 
                  AND opp_p.starter = true 
                  AND st.type_id = 2
                  AND e.season_year = :year
                GROUP BY a.throws
            """
            
            record, splits = await asyncio.gather(
                database.fetch_one(query=record_query, values={"team_id": team_id, "year": year}),
                database.fetch_all(query=splits_query, values={"team_id": team_id, "year": year})
            )
            
            return {
                "record": dict(record) if record else {},
                "splits": [dict(s) for s in splits]
            }

        async def get_pitcher_context(athlete_id: int):
            if not athlete_id: return None
            
            # 1. Season Stats
            stats_query = """
                SELECT 
                    COUNT(*) as starts,
                    SUM(k) as total_k,
                    SUM(bb) as total_bb,
                    SUM(er) as total_er,
                    SUM(h) as total_h,
                    SUM(CASE 
                        WHEN ip LIKE '%.1' THEN split_part(ip, '.', 1)::numeric + 0.33
                        WHEN ip LIKE '%.2' THEN split_part(ip, '.', 1)::numeric + 0.66
                        ELSE ip::numeric
                    END) as total_ip
                FROM event_boxscores_pitching p
                JOIN events e ON p.event_id = e.event_id
                JOIN season_types st ON e.season_year = st.season_year 
                    AND e.date >= st.start_date AND e.date <= st.end_date
                WHERE p.athlete_id = :athlete_id AND p.starter = true AND st.type_id = 2 AND e.season_year = :year
            """
            
            # 2. Last 5 Starts
            recent_query = """
                SELECT 
                    e.date,
                    p.ip, p.h, p.r, p.er, p.bb, p.k,
                    (SELECT t.abbreviation FROM season_teams t WHERE t.team_id = (SELECT team_id FROM event_competitors WHERE event_id = e.event_id AND team_id != p.team_id LIMIT 1) AND t.season_year = :year LIMIT 1) as opponent
                FROM event_boxscores_pitching p
                JOIN events e ON p.event_id = e.event_id
                JOIN season_types st ON e.season_year = st.season_year 
                    AND e.date >= st.start_date AND e.date <= st.end_date
                WHERE p.athlete_id = :athlete_id AND p.starter = true AND st.type_id = 2 AND e.season_year = :year
                ORDER BY e.date DESC
                LIMIT 5
            """
            
            # 3. Bio (throws)
            bio_query = "SELECT display_name, throws FROM athletes WHERE athlete_id = :athlete_id"
            
            stats, recent, bio = await asyncio.gather(
                database.fetch_one(query=stats_query, values={"athlete_id": athlete_id, "year": year}),
                database.fetch_all(query=recent_query, values={"athlete_id": athlete_id, "year": year}),
                database.fetch_one(query=bio_query, values={"athlete_id": athlete_id})
            )
            
            res = {
                "bio": dict(bio) if bio else {},
                "season_stats": dict(stats) if stats else {},
                "recent_starts": [dict(r) for r in recent]
            }
            
            # Calculate ERA/WHIP if possible
            if stats and stats['total_ip'] > 0:
                res["calculated_metrics"] = {
                    "era": round((stats['total_er'] * 9) / float(stats['total_ip']), 2),
                    "whip": round((stats['total_h'] + stats['total_bb']) / float(stats['total_ip']), 2),
                    "k_per_9": round((stats['total_k'] * 9) / float(stats['total_ip']), 2)
                }
                
            return res

        # 1. Fetch Odds
        odds_query = "SELECT away_money_line, home_money_line, over_under FROM event_odds WHERE event_id = :event_id LIMIT 1"
        
        # Run all context gathering in parallel
        away_task = get_team_context(away_team_id)
        home_task = get_team_context(home_team_id)
        away_pitcher_task = get_pitcher_context(away_starter_id)
        home_pitcher_task = get_pitcher_context(home_starter_id)
        odds_task = database.fetch_one(query=odds_query, values={"event_id": int(event_id)})
        
        away_ctx, home_ctx, away_p_ctx, home_p_ctx, odds = await asyncio.gather(
            away_task, home_task, away_pitcher_task, home_pitcher_task, odds_task
        )
        
        return {
            "event_id": event_id,
            "odds": dict(odds) if odds else {},
            "away_team": away_ctx,
            "home_team": home_ctx,
            "away_starter": away_p_ctx,
            "home_starter": home_p_ctx,
            "metadata": {
                "season": year,
                "season_type": "Regular Season"
            }
        }
    except Exception as e:
        print(f"Error in get_prediction_context: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
