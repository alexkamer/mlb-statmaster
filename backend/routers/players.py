from fastapi import APIRouter, HTTPException
from typing import Optional
import httpx
from datetime import datetime, timezone
import asyncio
from database import database

router = APIRouter()

@router.get("/api/players/{player_id}")
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
            COALESCE(
                (SELECT st.display_name FROM season_rosters sr JOIN season_teams st ON sr.season_team_id = st.season_team_id WHERE sr.athlete_id = a.athlete_id ORDER BY sr.season_year DESC LIMIT 1),
                (SELECT st.display_name FROM event_boxscores_batting b JOIN events e ON b.event_id = e.event_id JOIN season_teams st ON b.team_id = st.team_id AND e.season_year = st.season_year WHERE b.athlete_id = a.athlete_id ORDER BY e.date DESC LIMIT 1),
                (SELECT st.display_name FROM event_boxscores_pitching pt JOIN events e ON pt.event_id = e.event_id JOIN season_teams st ON pt.team_id = st.team_id AND e.season_year = st.season_year WHERE pt.athlete_id = a.athlete_id ORDER BY e.date DESC LIMIT 1)
            ) as team_name,
            COALESCE(
                (SELECT st.abbreviation FROM season_rosters sr JOIN season_teams st ON sr.season_team_id = st.season_team_id WHERE sr.athlete_id = a.athlete_id ORDER BY sr.season_year DESC LIMIT 1),
                (SELECT st.abbreviation FROM event_boxscores_batting b JOIN events e ON b.event_id = e.event_id JOIN season_teams st ON b.team_id = st.team_id AND e.season_year = st.season_year WHERE b.athlete_id = a.athlete_id ORDER BY e.date DESC LIMIT 1),
                (SELECT st.abbreviation FROM event_boxscores_pitching pt JOIN events e ON pt.event_id = e.event_id JOIN season_teams st ON pt.team_id = st.team_id AND e.season_year = st.season_year WHERE pt.athlete_id = a.athlete_id ORDER BY e.date DESC LIMIT 1)
            ) as team_abbreviation,
            COALESCE(
                (SELECT st.color FROM season_rosters sr JOIN season_teams st ON sr.season_team_id = st.season_team_id WHERE sr.athlete_id = a.athlete_id ORDER BY sr.season_year DESC LIMIT 1),
                (SELECT st.color FROM event_boxscores_batting b JOIN events e ON b.event_id = e.event_id JOIN season_teams st ON b.team_id = st.team_id AND e.season_year = st.season_year WHERE b.athlete_id = a.athlete_id ORDER BY e.date DESC LIMIT 1),
                (SELECT st.color FROM event_boxscores_pitching pt JOIN events e ON pt.event_id = e.event_id JOIN season_teams st ON pt.team_id = st.team_id AND e.season_year = st.season_year WHERE pt.athlete_id = a.athlete_id ORDER BY e.date DESC LIMIT 1)
            ) as team_color,
            COALESCE(
                (SELECT st.alternate_color FROM season_rosters sr JOIN season_teams st ON sr.season_team_id = st.season_team_id WHERE sr.athlete_id = a.athlete_id ORDER BY sr.season_year DESC LIMIT 1),
                (SELECT st.alternate_color FROM event_boxscores_batting b JOIN events e ON b.event_id = e.event_id JOIN season_teams st ON b.team_id = st.team_id AND e.season_year = st.season_year WHERE b.athlete_id = a.athlete_id ORDER BY e.date DESC LIMIT 1),
                (SELECT st.alternate_color FROM event_boxscores_pitching pt JOIN events e ON pt.event_id = e.event_id JOIN season_teams st ON pt.team_id = st.team_id AND e.season_year = st.season_year WHERE pt.athlete_id = a.athlete_id ORDER BY e.date DESC LIMIT 1)
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





@router.get("/api/players/gamelogs/batch")
async def get_batch_player_gamelogs(player_ids: str, year: int = None, limit: int = 15, inning: int = 1):
    """Get game logs for multiple players at once to prevent connection pooling bottlenecks."""
    try:
        p_ids = [int(p) for p in player_ids.split(",") if p.strip().isdigit()]
        if not p_ids:
            return {}
            
        type_filter = "st.type_id IN (2, 3)"
        year_filter = "AND e.season_year = :year" if year else ""
        
        # We need the last N logs per player. The easiest way without complex window functions in SQLite is:
        # Actually, Postgres supports ROW_NUMBER(). Since we use Postgres:
        
        batting_query = """
            WITH RankedBatting AS (
                SELECT 
                    b.athlete_id,
                    e.event_id,
                    e.date,
                    b.team_id,
                    b.ab, b.r, b.h, b.hr, b.rbi, b.bb, b.k, b.sb, 
                    COALESCE(b.d, 0) as d, COALESCE(b.t, 0) as t,
                    b.pitches_faced,
                    (COALESCE(b.h, 0) - COALESCE(b.d, 0) - COALESCE(b.t, 0) - COALESCE(b.hr, 0)) as singles,
                    ROW_NUMBER() OVER(PARTITION BY b.athlete_id ORDER BY e.date DESC) as rn
                FROM event_boxscores_batting b
                JOIN events e ON b.event_id = e.event_id
                LEFT JOIN season_types st ON e.season_year = st.season_year AND e.date >= st.start_date AND e.date <= st.end_date
                WHERE b.athlete_id = ANY(:p_ids) AND b.starter = true AND __TYPE_FILTER__ __YEAR_FILTER__
            )
            SELECT * FROM RankedBatting WHERE rn <= :limit
        """.replace("__TYPE_FILTER__", type_filter).replace("__YEAR_FILTER__", year_filter)
        
        pitching_query = """
            WITH RankedPitching AS (
                SELECT 
                    p.athlete_id,
                    e.event_id,
                    e.date,
                    p.team_id,
                    p.ip, p.h, p.r, p.er, p.hr, p.bb, p.k, p.pitches,
                    COALESCE(p.recorded_win, false) as recorded_win,
                    (SELECT c.winner FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id = p.team_id) as is_win,
                    (SELECT t.abbreviation FROM event_competitors c JOIN season_teams t ON c.season_team_id = t.season_team_id WHERE c.event_id = e.event_id AND c.team_id != p.team_id) as opponent_abbrev,
                    (SELECT c.team_id FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id != p.team_id) as opponent_id,
                    (SELECT c.home_away FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id = p.team_id) as home_away,
                    (
                        CASE 
                        WHEN NOT EXISTS (SELECT 1 FROM event_plays ep WHERE ep.event_id = e.event_id AND ep.inning = :inning AND ep.play_type_text = 'Start Batter/Pitcher' AND ep.text ILIKE '%' || a.display_name || '%') THEN NULL
                        WHEN (SELECT c.home_away FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id = p.team_id) = 'home' THEN 
                            (SELECT COALESCE(MAX(away_score) - MIN(away_score), 0) FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_id < COALESCE((SELECT MIN(play_id) FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_type_text = 'Start Batter/Pitcher' AND text NOT ILIKE '%' || a.display_name || '%' AND play_id < COALESCE((SELECT play_id FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_type_text = 'Start Inning' AND text ILIKE '%Bottom%' LIMIT 1), '9999999999999999999')), (SELECT play_id FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_type_text = 'Start Inning' AND text ILIKE '%Bottom%' LIMIT 1), '9999999999999999999'))
                        ELSE 
                            (SELECT COALESCE(MAX(home_score) - MIN(home_score), 0) FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_id > COALESCE((SELECT play_id FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_type_text = 'Start Inning' AND text ILIKE '%Bottom%' LIMIT 1), '0') AND play_id < COALESCE((SELECT MIN(play_id) FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_type_text = 'Start Batter/Pitcher' AND text NOT ILIKE '%' || a.display_name || '%' AND play_id > COALESCE((SELECT play_id FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_type_text = 'Start Inning' AND text ILIKE '%Bottom%' LIMIT 1), '0')), '9999999999999999999'))
                        END
                    ) as inning_runs_allowed,
                    (
                        SELECT COALESCE(MAX(away_score) - MIN(away_score), 0) + COALESCE(MAX(home_score) - MIN(home_score), 0)
                        FROM event_plays WHERE event_id = e.event_id AND inning = :inning
                    ) as inning_total_runs,
                    (
                        CASE 
                        WHEN NOT EXISTS (SELECT 1 FROM event_plays ep WHERE ep.event_id = e.event_id AND ep.inning = :inning AND ep.play_type_text = 'Start Batter/Pitcher' AND ep.text ILIKE '%' || a.display_name || '%') THEN NULL
                        WHEN (SELECT c.home_away FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id = p.team_id) = 'home' THEN 
                            (SELECT COUNT(*) FROM event_plays ep WHERE ep.event_id = e.event_id AND ep.inning = :inning AND ep.play_type_text = 'Play Result' AND ep.text ~* '\y(singled|doubled|tripled|homered|homers|homer|infield single)\y' AND ep.text !~* '\y(double play|triple play|doubled off|tripled off)\y' AND ep.play_id < COALESCE((SELECT MIN(play_id) FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_type_text = 'Start Batter/Pitcher' AND text NOT ILIKE '%' || a.display_name || '%' AND play_id < COALESCE((SELECT play_id FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_type_text = 'Start Inning' AND text ILIKE '%Bottom%' LIMIT 1), '9999999999999999999')), (SELECT play_id FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_type_text = 'Start Inning' AND text ILIKE '%Bottom%' LIMIT 1), '9999999999999999999'))
                        ELSE 
                            (SELECT COUNT(*) FROM event_plays ep WHERE ep.event_id = e.event_id AND ep.inning = :inning AND ep.play_type_text = 'Play Result' AND ep.text ~* '\y(singled|doubled|tripled|homered|homers|homer|infield single)\y' AND ep.text !~* '\y(double play|triple play|doubled off|tripled off)\y' AND ep.play_id > COALESCE((SELECT play_id FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_type_text = 'Start Inning' AND text ILIKE '%Bottom%' LIMIT 1), '0') AND ep.play_id < COALESCE((SELECT MIN(play_id) FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_type_text = 'Start Batter/Pitcher' AND text NOT ILIKE '%' || a.display_name || '%' AND play_id > COALESCE((SELECT play_id FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_type_text = 'Start Inning' AND text ILIKE '%Bottom%' LIMIT 1), '0')), '9999999999999999999'))
                        END
                    ) as inning_hits_allowed,
                    (
                        SELECT COUNT(*) FROM event_plays ep WHERE ep.event_id = e.event_id AND ep.inning = :inning AND ep.play_type_text = 'Play Result' AND ep.text ~* '\y(singled|doubled|tripled|homered|homers|homer|infield single)\y' AND ep.text !~* '\y(double play|triple play|doubled off|tripled off)\y'
                    ) as inning_total_hits,
                    (
                        CASE 
                        WHEN NOT EXISTS (SELECT 1 FROM event_plays ep WHERE ep.event_id = e.event_id AND ep.inning = :inning AND ep.play_type_text = 'Start Batter/Pitcher' AND ep.text ILIKE '%' || a.display_name || '%') THEN NULL
                        WHEN (SELECT c.home_away FROM event_competitors c WHERE c.event_id = e.event_id AND c.team_id = p.team_id) = 'home' THEN 
                            (SELECT COUNT(*) FROM event_plays ep WHERE ep.event_id = e.event_id AND ep.inning = :inning AND ep.play_type_text = 'Play Result' AND ep.text ILIKE '%struck out%' AND ep.play_id < COALESCE((SELECT MIN(play_id) FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_type_text = 'Start Batter/Pitcher' AND text NOT ILIKE '%' || a.display_name || '%' AND play_id < COALESCE((SELECT play_id FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_type_text = 'Start Inning' AND text ILIKE '%Bottom%' LIMIT 1), '9999999999999999999')), (SELECT play_id FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_type_text = 'Start Inning' AND text ILIKE '%Bottom%' LIMIT 1), '9999999999999999999'))
                        ELSE 
                            (SELECT COUNT(*) FROM event_plays ep WHERE ep.event_id = e.event_id AND ep.inning = :inning AND ep.play_type_text = 'Play Result' AND ep.text ILIKE '%struck out%' AND ep.play_id > COALESCE((SELECT play_id FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_type_text = 'Start Inning' AND text ILIKE '%Bottom%' LIMIT 1), '0') AND ep.play_id < COALESCE((SELECT MIN(play_id) FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_type_text = 'Start Batter/Pitcher' AND text NOT ILIKE '%' || a.display_name || '%' AND play_id > COALESCE((SELECT play_id FROM event_plays WHERE event_id = e.event_id AND inning = :inning AND play_type_text = 'Start Inning' AND text ILIKE '%Bottom%' LIMIT 1), '0')), '9999999999999999999'))
                        END
                    ) as inning_k_recorded,
                    (
                        SELECT COUNT(*) FROM event_plays ep WHERE ep.event_id = e.event_id AND ep.inning = :inning AND ep.play_type_text = 'Play Result' AND ep.text ILIKE '%struck out%'
                    ) as inning_total_k,
                    ROW_NUMBER() OVER(PARTITION BY p.athlete_id ORDER BY e.date DESC) as rn
                FROM event_boxscores_pitching p
                JOIN athletes a ON p.athlete_id = a.athlete_id
                JOIN events e ON p.event_id = e.event_id
                LEFT JOIN season_types st ON e.season_year = st.season_year AND e.date >= st.start_date AND e.date <= st.end_date
                WHERE p.athlete_id = ANY(:p_ids) AND p.starter = true AND __TYPE_FILTER__ __YEAR_FILTER__
            )
            SELECT * FROM RankedPitching WHERE rn <= :limit
        """.replace("__TYPE_FILTER__", type_filter).replace("__YEAR_FILTER__", year_filter)

        query_params = {"limit": limit, "p_ids": p_ids, "inning": inning}
        if year:
            query_params["year"] = year

        batting_logs = await database.fetch_all(query=batting_query, values={k: v for k, v in query_params.items() if k != 'inning'})
        pitching_logs = await database.fetch_all(query=pitching_query, values=query_params)
        
        result_map = {pid: {"batting": [], "pitching": [], "season_batting": None, "season_pitching": None} for pid in p_ids}

        if year:
            # Calculate season totals for context weighting
            season_batting_query = f"""
                SELECT 
                    b.athlete_id,
                    COUNT(b.event_id) as g,
                    SUM(b.ab) as ab, SUM(b.r) as r, SUM(b.h) as h, SUM(b.hr) as hr, SUM(b.rbi) as rbi, SUM(b.bb) as bb, SUM(b.k) as k, SUM(b.sb) as sb,
                    SUM(COALESCE(b.d, 0)) as d, SUM(COALESCE(b.t, 0)) as t,
                    SUM(b.pitches_faced) as pitches_faced,
                    SUM(COALESCE(b.h, 0) - COALESCE(b.d, 0) - COALESCE(b.t, 0) - COALESCE(b.hr, 0)) as singles
                FROM event_boxscores_batting b
                JOIN events e ON b.event_id = e.event_id
                LEFT JOIN season_types st ON e.season_year = st.season_year AND e.date >= st.start_date AND e.date <= st.end_date
                WHERE b.athlete_id = ANY(:p_ids) AND b.starter = true AND {type_filter} AND e.season_year = :year
                GROUP BY b.athlete_id
            """
            
            season_pitching_query = f"""
                SELECT 
                    p.athlete_id,
                    COUNT(p.event_id) as g,
                    SUM(p.h) as h, SUM(p.r) as r, SUM(p.er) as er, SUM(p.hr) as hr, SUM(p.bb) as bb, SUM(p.k) as k, SUM(p.pitches) as pitches,
                    SUM(CASE WHEN c.winner = true AND c.team_id = p.team_id THEN 1 ELSE 0 END) as w,
                    SUM(CAST(SPLIT_PART(COALESCE(NULLIF(p.ip, '--.--'), '0.0'), '.', 1) AS INTEGER) * 3 + CAST(SPLIT_PART(COALESCE(NULLIF(p.ip, '--.--'), '0.0'), '.', 2) AS INTEGER)) as outs_recorded
                FROM event_boxscores_pitching p
                JOIN athletes a ON p.athlete_id = a.athlete_id
                JOIN events e ON p.event_id = e.event_id
                LEFT JOIN season_types st ON e.season_year = st.season_year AND e.date >= st.start_date AND e.date <= st.end_date
                LEFT JOIN event_competitors c ON e.event_id = c.event_id AND p.team_id = c.team_id
                WHERE p.athlete_id = ANY(:p_ids) AND p.starter = true AND {type_filter} AND e.season_year = :year
                GROUP BY p.athlete_id
            """
            
            season_batting_stats = await database.fetch_all(query=season_batting_query, values={"p_ids": p_ids, "year": year})
            season_pitching_stats = await database.fetch_all(query=season_pitching_query, values={"p_ids": p_ids, "year": year})
            
            for sb in season_batting_stats:
                result_map[sb['athlete_id']]['season_batting'] = dict(sb)
                
            for sp in season_pitching_stats:
                result_map[sp['athlete_id']]['season_pitching'] = dict(sp)
        
        
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


@router.get("/api/players/{player_id}/gamelog")
async def get_player_gamelog(player_id: int, year: int = None, limit: int = 15, season_type_id: int = None):
    """Get a player's game-by-game logs for a specific season, or last N games if year is omitted."""
    type_filter = "st.type_id = :season_type_id" if season_type_id else "st.type_id IN (2, 3)"
    year_filter = "AND e.season_year = :year" if year else ""

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
        WHERE b.athlete_id = :player_id AND b.starter = true AND __TYPE_FILTER__ __YEAR_FILTER__
        ORDER BY e.date DESC
        LIMIT :limit
    """.replace("__TYPE_FILTER__", type_filter).replace("__YEAR_FILTER__", year_filter)

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
        WHERE p.athlete_id = :player_id AND p.starter = true AND __TYPE_FILTER__ __YEAR_FILTER__
        ORDER BY e.date DESC
        LIMIT :limit
    """.replace("__TYPE_FILTER__", type_filter).replace("__YEAR_FILTER__", year_filter)

    try:
        query_params = {"player_id": player_id, "limit": limit}
        if year:
            query_params["year"] = year
        if season_type_id:
            query_params["season_type_id"] = season_type_id            
        batting_logs = await database.fetch_all(query=batting_query, values={k: v for k, v in query_params.items() if k != 'inning'})
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


@router.get("/api/players/{player_id}/props")
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


