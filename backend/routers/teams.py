from fastapi import APIRouter, HTTPException
from typing import Optional
import httpx
from datetime import datetime, timezone
import asyncio
from database import database

router = APIRouter()

@router.get("/api/teams")
async def get_teams(year: int = 2024):
    """Get all teams active in a specific year."""
    query = """
        SELECT team_id, location, name, display_name, abbreviation, color, alternate_color, group_id
        FROM season_teams
        WHERE season_year = :year
        ORDER BY location
    """
    return await database.fetch_all(query=query, values={"year": year})


@router.get("/api/teams/{team_id}/stats")
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


@router.get("/api/teams/{team_id}/roster")
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


@router.get("/api/teams/{team_id}/roster/pitching")
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



@router.get("/api/teams/{team_id}/recent_games")
async def get_recent_games(team_id: int, limit: int = 5, year: int = 2024, season_type_id: int = None, inning: int = 1):
    """Get the recent results for a team, optionally filtered by year and season type."""
    try:
        where_clause = "WHERE c1.score IS NOT NULL"
        query_params = {"team_id": team_id, "limit": limit, "inning": inning}

        if season_type_id:
            where_clause += " AND st.type_id = :season_type_id"
            query_params["season_type_id"] = season_type_id
        else:
            where_clause += " AND e.season_year = :year AND st.type_id IN (2, 3)"
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
                c1.home_away as location,
                (
                    CASE WHEN c1.home_away = 'home' THEN 
                        (SELECT COALESCE(MAX(home_score) - MIN(home_score), 0) FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_id > COALESCE((SELECT play_id FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_type_text = 'Start Inning' AND text ILIKE '%Bottom%' LIMIT 1), '0'))
                    ELSE 
                        (SELECT COALESCE(MAX(away_score) - MIN(away_score), 0) FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_id < COALESCE((SELECT play_id FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_type_text = 'Start Inning' AND text ILIKE '%Bottom%' LIMIT 1), '9999999999999999999'))
                    END
                ) as inning_runs_scored,
                (
                    SELECT COALESCE(MAX(away_score) - MIN(away_score), 0) + COALESCE(MAX(home_score) - MIN(home_score), 0)
                    FROM event_plays WHERE event_id = e.event_id AND inning = :inning
                ) as inning_total_runs,
                (
                    SELECT COUNT(*) FROM event_plays ep WHERE ep.event_id = e.event_id AND ep.inning = :inning AND ep.play_type_text = 'Play Result' AND ep.text ~* '\y(singled|doubled|tripled|homered|homers|homer|infield single)\y' AND ep.text !~* '\y(double play|triple play|doubled off|tripled off)\y' AND 
                        CASE WHEN c1.home_away = 'home' THEN 
                            ep.play_id > COALESCE((SELECT play_id FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_type_text = 'Start Inning' AND text ILIKE '%Bottom%' LIMIT 1), '0')
                        ELSE 
                            ep.play_id < COALESCE((SELECT play_id FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_type_text = 'Start Inning' AND text ILIKE '%Bottom%' LIMIT 1), '9999999999999999999')
                        END
                ) as inning_hits_scored,
                (
                    SELECT COUNT(*) FROM event_plays ep WHERE ep.event_id = e.event_id AND ep.inning = :inning AND ep.play_type_text = 'Play Result' AND ep.text ~* '\y(singled|doubled|tripled|homered|homers|homer|infield single)\y' AND ep.text !~* '\y(double play|triple play|doubled off|tripled off)\y'
                ) as inning_total_hits,
                (
                    SELECT a.display_name 
                    FROM event_boxscores_pitching bp 
                    JOIN athletes a ON bp.athlete_id = a.athlete_id 
                    WHERE bp.event_id = e.event_id AND bp.team_id = c2.team_id AND bp.starter = true 
                    LIMIT 1
                ) as opp_starter_name
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

@router.get("/api/teams/{team_id}/games")
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



@router.get("/api/teams/{team_id}/live_roster")
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



@router.get("/api/teams/{team_id}/opponents/starters")
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


@router.get("/api/teams/{team_id}/opponents/batters")
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



@router.get("/api/teams/{team_id}/splits/batting")
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


@router.get("/api/teams/{team_id}/espn_data")
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



@router.get("/api/teams/{team_id}/depthchart")
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



@router.get("/api/teams/{team_id}/leaders")
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



@router.get("/api/teams/{team_id}/standing")
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



