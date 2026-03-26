def main():
    print("Hello from mlb-webapp!")


if __name__ == "__main__":
    main()


@app.get("/api/games")
async def get_all_games(year: int = 2024, page: int = 1, limit: int = 50):
    """Get a paginated list of all games in a specific season."""
    offset = (page - 1) * limit
    
    # We use a subquery to avoid massive JOIN fanouts on the counting step
    count_query = "SELECT COUNT(*) FROM events WHERE season_year = :year"
    total_count = await database.fetch_val(query=count_query, values={"year": year})
    
query = """
        SELECT 
            e.event_id,
            e.date,
            e.name as matchup,
            e.short_name,
            st.name as season_type_name,
            c1.score as team_score,
            c2.score as opponent_score,
            c2.team_id as opponent_id,
            t2.display_name as opponent_name,
            t2.abbreviation as opponent_abbreviation,
            c1.winner,
            c1.home_away as location,
            
            -- Find the winning pitcher from the boxscores
            (SELECT a.full_name 
             FROM event_boxscores_pitching p 
             JOIN athletes a ON p.athlete_id = a.athlete_id 
             WHERE p.event_id = e.event_id AND p.decision = true AND p.team_id = (CASE WHEN c1.winner = true THEN c1.team_id ELSE c2.team_id END)
             LIMIT 1) as winning_pitcher,
             
            -- Find the losing pitcher
            (SELECT a.full_name 
             FROM event_boxscores_pitching p 
             JOIN athletes a ON p.athlete_id = a.athlete_id 
             WHERE p.event_id = e.event_id AND p.decision = true AND p.team_id = (CASE WHEN c1.winner = false THEN c1.team_id ELSE c2.team_id END)
             LIMIT 1) as losing_pitcher

        FROM events e
        LEFT JOIN season_types st ON e.season_type_id = st.season_type_id
        JOIN event_competitors c1 ON e.event_id = c1.event_id AND c1.team_id = :team_id
        JOIN event_competitors c2 ON e.event_id = c2.event_id AND c2.team_id != :team_id
        LEFT JOIN season_teams t2 ON c2.season_team_id = t2.season_team_id
        WHERE e.season_year = :year
        ORDER BY e.date DESC
        LIMIT :limit OFFSET :offset
    """
    
    games = await database.fetch_all(query=query, values={"year": year, "limit": limit, "offset": offset})
    
    return {
        "data": games,
        "meta": {
            "total_items": total_count,
            "page": page,
            "limit": limit,
            "total_pages": (total_count + limit - 1) // limit
        }
    }

@app.get("/api/teams/{team_id}/games")
async def get_team_games_paginated(team_id: int, year: int = 2024, page: int = 1, limit: int = 20):
    """Get a paginated list of games for a specific team."""
    offset = (page - 1) * limit
    
    # Get the total count for this specific team
    count_query = """
        SELECT COUNT(*) 
        FROM events e
        JOIN event_competitors c ON e.event_id = c.event_id 
        WHERE c.team_id = :team_id AND e.season_year = :year
    """
    total_count = await database.fetch_val(query=count_query, values={"team_id": team_id, "year": year})
    
query = """
        SELECT 
            e.event_id,
            e.date,
            e.name as matchup,
            e.short_name,
            st.name as season_type_name,
            c1.score as team_score,
            c2.score as opponent_score,
            c2.team_id as opponent_id,
            t2.display_name as opponent_name,
            t2.abbreviation as opponent_abbreviation,
            c1.winner,
            c1.home_away as location,
            
            -- Find the winning pitcher from the boxscores
            (SELECT a.full_name 
             FROM event_boxscores_pitching p 
             JOIN athletes a ON p.athlete_id = a.athlete_id 
             WHERE p.event_id = e.event_id AND p.decision = true AND p.team_id = (CASE WHEN c1.winner = true THEN c1.team_id ELSE c2.team_id END)
             LIMIT 1) as winning_pitcher,
             
            -- Find the losing pitcher
            (SELECT a.full_name 
             FROM event_boxscores_pitching p 
             JOIN athletes a ON p.athlete_id = a.athlete_id 
             WHERE p.event_id = e.event_id AND p.decision = true AND p.team_id = (CASE WHEN c1.winner = false THEN c1.team_id ELSE c2.team_id END)
             LIMIT 1) as losing_pitcher

        FROM events e
        LEFT JOIN season_types st ON e.season_type_id = st.season_type_id
        JOIN event_competitors c1 ON e.event_id = c1.event_id AND c1.team_id = :team_id
        JOIN event_competitors c2 ON e.event_id = c2.event_id AND c2.team_id != :team_id
        LEFT JOIN season_teams t2 ON c2.season_team_id = t2.season_team_id
        WHERE e.season_year = :year
        ORDER BY e.date DESC
        LIMIT :limit OFFSET :offset
    """
    
    games = await database.fetch_all(query=query, values={"team_id": team_id, "year": year, "limit": limit, "offset": offset})
    
    return {
        "data": games,
        "meta": {
            "total_items": total_count,
            "page": page,
            "limit": limit,
            "total_pages": (total_count + limit - 1) // limit if total_count else 0
        }
    }

@app.get("/api/teams/{team_id}/live_roster")
async def get_live_team_roster(team_id: int):
    """Fetch the live 40-man roster directly from ESPN to ensure it is 100% up to date for today."""
    import httpx
    url = f"https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/{team_id}/roster"
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Failed to fetch live roster")
        
        data = resp.json()
        
        # Flatten the categorizes roster (Pitchers, Catchers, Infielders) into a single list
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
