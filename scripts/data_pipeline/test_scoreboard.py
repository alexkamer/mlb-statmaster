import httpx

url = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=20260405"
response = httpx.get(url).json()

events = response.get('events', [])
print(f"Total Events Found: {len(events)}")

if len(events) > 0:
    first_event = events[0]
    print(f"\nExample Game: {first_event['name']} @ {first_event['date']}")
    
    # Check where probables live
    comp = first_event['competitions'][0]
    competitors = comp['competitors']
    
    for team in competitors:
        team_name = team['team']['displayName']
        probables = team.get('probables', [])
        if probables:
            pitcher_name = probables[0]['athlete']['displayName']
            pitcher_id = probables[0]['athlete']['id']
            print(f"  {team_name} Starter: {pitcher_name} (ID: {pitcher_id})")
        else:
            print(f"  {team_name} Starter: TBD")
            
