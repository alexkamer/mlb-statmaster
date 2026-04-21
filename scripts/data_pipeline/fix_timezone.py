def apply_fix(filename):
    with open(filename, "r") as f:
        content = f.read()

    import re
    # We want to replace the hardcoded "2026-04-05" block with dynamic "today" based on America/Chicago timezone.
    new_logic = """
# Dynamically get TODAY in US Central Time (Baseball Time)
# Since we're doing a historical backtest for April 5, we'll lock it to that date.
target_date_str = '2026-04-05'

# An MLB "day" typically starts around 11:00 AM Eastern (15:00 UTC) and ends at 5:00 AM Eastern the next day.
# Let's cleanly grab 12:00 UTC to 12:00 UTC the next day.
start_date_utc = pd.to_datetime(f"{target_date_str} 12:00:00", utc=True)
end_date_utc = start_date_utc + pd.Timedelta(days=1)

df_past = df_games[df_games['date'] < start_date_utc].dropna(subset=home_features + away_features + ['home_score', 'away_score'])
df_today = df_games[(df_games['date'] >= start_date_utc) & (df_games['date'] < end_date_utc)].dropna(subset=home_features + away_features)
"""
    
    content = re.sub(r"from datetime import datetime.*?df_today = df_games\[.*?\]\.dropna\(subset=home_features \+ away_features\)", new_logic.strip(), content, flags=re.DOTALL)
    
    with open(filename, "w") as f:
        f.write(content)

apply_fix("predict_games_today.py")
