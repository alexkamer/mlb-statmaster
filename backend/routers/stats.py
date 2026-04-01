from fastapi import APIRouter, HTTPException
from typing import Optional
import httpx
from datetime import datetime, timezone
import asyncio
from database import database

router = APIRouter()

@router.get("/api/bvp/{batter_id}/{pitcher_id}")
async def get_bvp_stats(batter_id: int, pitcher_id: int):
    """Get historical Batter vs Pitcher head-to-head stats by finding games where both played against each other."""
    query = """
        SELECT 
            COUNT(b.event_id) as g,
            SUM(b.ab) as ab,
            SUM(b.h) as h,
            SUM(b.hr) as hr,
            SUM(b.rbi) as rbi,
            SUM(b.k) as k,
            SUM(b.bb) as bb,
            SUM(COALESCE(b.d, 0)) as d,
            SUM(COALESCE(b.t, 0)) as t,
            CASE WHEN SUM(b.ab) > 0 THEN ROUND((SUM(b.h)::numeric / SUM(b.ab)), 3) ELSE 0 END as avg,
            CASE WHEN SUM(b.ab + b.bb) > 0 THEN ROUND(((SUM(b.h) + SUM(b.bb))::numeric / SUM(b.ab + b.bb)), 3) ELSE 0 END as obp,
            CASE WHEN SUM(b.ab) > 0 THEN ROUND(((SUM(b.h) + SUM(b.hr)*3 + SUM(COALESCE(b.d, 0)) + SUM(COALESCE(b.t, 0))*2)::numeric / SUM(b.ab)), 3) ELSE 0 END as slg
        FROM event_boxscores_batting b
        JOIN event_boxscores_pitching p ON b.event_id = p.event_id
        WHERE b.athlete_id = :batter_id AND p.athlete_id = :pitcher_id AND b.team_id != p.team_id
    """
    try:
        stats = await database.fetch_one(query=query, values={"batter_id": batter_id, "pitcher_id": pitcher_id})
        return dict(stats) if stats else {}
    except Exception as e:
        print(f"Error fetching BvP stats: {e}")
        return {}


@router.get("/api/stats/league")
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


@router.get("/api/predictions/context")
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


