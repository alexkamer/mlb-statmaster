import pandas as pd
import numpy as np
import sqlalchemy
from xgboost import XGBRegressor, XGBClassifier
import warnings
warnings.filterwarnings('ignore')

print("1. Querying Game Data & Odds...")
engine = sqlalchemy.create_engine("postgresql:///mlb_db")

query_games = """
SELECT e.event_id, e.date, e.venue_id,
       c_home.team_id as home_team_id, c_home.score as home_score, c_home.winner as home_win,
       c_away.team_id as away_team_id, c_away.score as away_score
FROM events e
JOIN event_competitors c_home ON e.event_id = c_home.event_id AND c_home.home_away = 'home'
JOIN event_competitors c_away ON e.event_id = c_away.event_id AND c_away.home_away = 'away'
WHERE (e.type_id != 1 OR e.type_id IS NULL)
ORDER BY e.date ASC
"""
df_games = pd.read_sql(query_games, engine)
df_games['date'] = pd.to_datetime(df_games['date'], utc=True)
df_games['total_score'] = df_games['home_score'] + df_games['away_score']
df_games['home_win'] = df_games['home_win'].fillna(False).astype(int)

# Odds
query_odds = "SELECT event_id, AVG(over_under) as vegas_ou, AVG(away_money_line) as vegas_away_ml, AVG(home_money_line) as vegas_home_ml FROM event_odds GROUP BY event_id"
df_odds = pd.read_sql(query_odds, engine)
df_games = pd.merge(df_games, df_odds, on='event_id', how='left')

print("2. Calculating Rolling Team Averages (Offense & Defense)...")
# To prevent lookahead bias, we build a log of every team's games, calculate rolling stats, then merge back.
team_logs = []

# Home games
home_log = df_games[['event_id', 'date', 'home_team_id', 'home_score', 'away_score']].copy()
home_log.columns = ['event_id', 'date', 'team_id', 'runs_scored', 'runs_allowed']
# Away games
away_log = df_games[['event_id', 'date', 'away_team_id', 'away_score', 'home_score']].copy()
away_log.columns = ['event_id', 'date', 'team_id', 'runs_scored', 'runs_allowed']

df_teams = pd.concat([home_log, away_log]).sort_values('date')
df_teams['runs_scored_last_10'] = df_teams.groupby('team_id')['runs_scored'].transform(lambda x: x.shift(1).rolling(10, min_periods=1).mean())
df_teams['runs_allowed_last_10'] = df_teams.groupby('team_id')['runs_allowed'].transform(lambda x: x.shift(1).rolling(10, min_periods=1).mean())
df_teams['runs_scored_last_3'] = df_teams.groupby('team_id')['runs_scored'].transform(lambda x: x.shift(1).rolling(3, min_periods=1).mean())

# Merge rolling stats back to the main games dataframe
df_games = pd.merge(df_games, 
                    df_teams[['event_id', 'team_id', 'runs_scored_last_10', 'runs_allowed_last_10', 'runs_scored_last_3']], 
                    left_on=['event_id', 'home_team_id'], right_on=['event_id', 'team_id'], how='left')
df_games.rename(columns={'runs_scored_last_10': 'home_rs_10', 'runs_allowed_last_10': 'home_ra_10', 'runs_scored_last_3': 'home_rs_3'}, inplace=True)

df_games = pd.merge(df_games, 
                    df_teams[['event_id', 'team_id', 'runs_scored_last_10', 'runs_allowed_last_10', 'runs_scored_last_3']], 
                    left_on=['event_id', 'away_team_id'], right_on=['event_id', 'team_id'], how='left')
df_games.rename(columns={'runs_scored_last_10': 'away_rs_10', 'runs_allowed_last_10': 'away_ra_10', 'runs_scored_last_3': 'away_rs_3'}, inplace=True)

# Park Factors
df_games['venue_id'] = df_games['venue_id'].fillna(0).astype(int)
df_games['park_factor_runs'] = df_games.groupby('venue_id')['total_score'].transform(lambda x: x.shift(1).expanding().mean())
df_games['park_factor_runs'] = df_games['park_factor_runs'].fillna(df_games['total_score'].mean()) # Fill early games

df_games['vegas_ou'] = df_games['vegas_ou'].fillna(df_games['total_score'].mean())
df_games['vegas_home_ml'] = df_games['vegas_home_ml'].fillna(0)
df_games['vegas_away_ml'] = df_games['vegas_away_ml'].fillna(0)


# Add starting pitcher IDs to the games
query_starters = """
SELECT event_id, team_id, athlete_id as starter_id 
FROM event_boxscores_pitching 
WHERE starter = true
"""
df_starters = pd.read_sql(query_starters, engine)
df_games = pd.merge(df_games, df_starters, left_on=['event_id', 'home_team_id'], right_on=['event_id', 'team_id'], how='left')
df_games.rename(columns={'starter_id': 'home_starter_id'}, inplace=True)
df_games.drop(columns=['team_id'], inplace=True)

df_games = pd.merge(df_games, df_starters, left_on=['event_id', 'away_team_id'], right_on=['event_id', 'team_id'], how='left')
df_games.rename(columns={'starter_id': 'away_starter_id'}, inplace=True)
df_games.drop(columns=['team_id'], inplace=True)

# We will need Pitcher rolling stats (ERA proxy: Runs Allowed per Out)
query_pitcher_runs = """
SELECT p.event_id, e.date, p.athlete_id as pitcher_id, p.r as runs_allowed, p.ip
FROM event_boxscores_pitching p
JOIN events e ON p.event_id = e.event_id
WHERE p.starter = true
ORDER BY e.date ASC
"""
df_p_runs = pd.read_sql(query_pitcher_runs, engine)

def calc_outs(ip_str):
    try:
        if pd.isna(ip_str): return 0
        s = str(ip_str).strip()
        if not s or s == '--': return 0
        parts = s.split('.')
        outs = int(parts[0]) * 3
        if len(parts) > 1 and parts[1].isdigit(): outs += int(parts[1])
        return outs
    except: return 0
df_p_runs['outs'] = df_p_runs['ip'].apply(calc_outs)
df_p_runs = df_p_runs.sort_values('date')

p_group = df_p_runs.groupby('pitcher_id')
df_p_runs['p_ra_10'] = p_group['runs_allowed'].transform(lambda x: x.shift(1).rolling(10, min_periods=1).mean())
df_p_runs['p_outs_10'] = p_group['outs'].transform(lambda x: x.shift(1).rolling(10, min_periods=1).mean())
df_p_runs['p_runs_per_out'] = df_p_runs['p_ra_10'] / df_p_runs['p_outs_10']
df_p_runs['p_runs_per_game'] = df_p_runs['p_runs_per_out'] * 27 # Equivalent of ERA per 9 innings

# Join Home Pitcher Stats
df_games = pd.merge(df_games, df_p_runs[['event_id', 'pitcher_id', 'p_runs_per_game']], left_on=['event_id', 'home_starter_id'], right_on=['event_id', 'pitcher_id'], how='left')
df_games.rename(columns={'p_runs_per_game': 'home_pitcher_era'}, inplace=True)

# Join Away Pitcher Stats
df_games = pd.merge(df_games, df_p_runs[['event_id', 'pitcher_id', 'p_runs_per_game']], left_on=['event_id', 'away_starter_id'], right_on=['event_id', 'pitcher_id'], how='left')
df_games.rename(columns={'p_runs_per_game': 'away_pitcher_era'}, inplace=True)

# Add to Expected baseline
df_games['expected_home_runs'] = (df_games['home_rs_10'] + df_games['away_pitcher_era'].fillna(4.5)) / 2
df_games['expected_away_runs'] = (df_games['away_rs_10'] + df_games['home_pitcher_era'].fillna(4.5)) / 2
df_games['expected_total_runs'] = df_games['expected_home_runs'] + df_games['expected_away_runs']
df_games['expected_run_diff'] = df_games['expected_home_runs'] - df_games['expected_away_runs']

features = [
    'expected_total_runs', 'expected_run_diff', 
    'home_rs_10', 'home_rs_3', 'home_pitcher_era',
    'away_rs_10', 'away_rs_3', 'away_pitcher_era',
    'park_factor_runs', 'vegas_ou', 'vegas_home_ml', 'vegas_away_ml'
]

df_games = df_games.replace([np.inf, -np.inf], np.nan)
df_games = df_games.dropna(subset=features)
df_past = df_games[(df_games['date'] < '2026-03-26') & (df_games['total_score'].notna())]
df_test = df_games[(df_games['date'] >= '2026-03-26') & (df_games['date'] < '2026-04-05') & (df_games['total_score'].notna())]

print("3. Training Game Totals (O/U) & Moneyline (Winner) Models...")
# Model 1: Total Runs (Poisson)
model_totals = XGBRegressor(n_estimators=100, max_depth=4, learning_rate=0.05, random_state=42, objective='count:poisson')
model_totals.fit(df_past[features], df_past['total_score'])

# Model 2: Moneyline Winner (Classification)
model_ml = XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.05, random_state=42, eval_metric='logloss')
model_ml.fit(df_past[features], df_past['home_win'])

df_test['pred_total_runs'] = model_totals.predict(df_test[features])
df_test['pred_home_win_prob'] = model_ml.predict_proba(df_test[features])[:, 1]

# --- BACKTESTING LOGIC ---
wins_ou, losses_ou, pushes_ou = 0, 0, 0
wins_ml, losses_ml, passes_ml = 0, 0, 0

def calc_implied_prob(american_odds):
    try:
        odds = float(american_odds)
        if odds == 0: return 0.5
        if odds > 0: return 100 / (odds + 100)
        else: return -odds / (-odds + 100)
    except: return 0.5

print("\n" + "="*45)
print("💰 MLB GAME PREDICTIONS BACKTEST (10 DAYS)")
print("="*45)

for _, row in df_test.iterrows():
    # 1. OVER/UNDER BETTING
    real_ou = row['vegas_ou']
    actual_total = row['total_score']
    pred_total = row['pred_total_runs']
    
    bet_ou = "PASS"
    if pred_total > (real_ou + 0.6): bet_ou = "OVER"
    elif pred_total < (real_ou - 0.6): bet_ou = "UNDER"
    
    if bet_ou == "OVER" and actual_total > real_ou: wins_ou += 1
    elif bet_ou == "UNDER" and actual_total < real_ou: wins_ou += 1
    elif actual_total == real_ou and bet_ou != "PASS": pushes_ou += 1
    elif bet_ou != "PASS": losses_ou += 1

    # 2. MONEYLINE BETTING
    vegas_home_prob = calc_implied_prob(row['vegas_home_ml'])
    vegas_away_prob = calc_implied_prob(row['vegas_away_ml'])
    # Vig removal
    total_implied = vegas_home_prob + vegas_away_prob
    if total_implied > 0:
        true_vegas_home = vegas_home_prob / total_implied
        true_vegas_away = vegas_away_prob / total_implied
    else:
        true_vegas_home, true_vegas_away = 0.5, 0.5
        
    model_home_prob = row['pred_home_win_prob']
    model_away_prob = 1 - model_home_prob
    actual_home_win = row['home_win']
    
    bet_ml = "PASS"
    # Need a 4% edge over Vegas true probability to bet the Moneyline
    if model_home_prob > (true_vegas_home + 0.04): bet_ml = "HOME"
    elif model_away_prob > (true_vegas_away + 0.04): bet_ml = "AWAY"
    else: passes_ml += 1
        
    if bet_ml == "HOME" and actual_home_win == 1: wins_ml += 1
    elif bet_ml == "AWAY" and actual_home_win == 0: wins_ml += 1
    elif bet_ml != "PASS": losses_ml += 1

print("--- OVER/UNDER (TOTALS) ---")
print(f"Bets Placed: {wins_ou + losses_ou + pushes_ou}")
print(f"Wins: {wins_ou} | Losses: {losses_ou} | Pushes: {pushes_ou}")
if (wins_ou + losses_ou) > 0: print(f"Win %: {wins_ou / (wins_ou + losses_ou):.1%}")

print("\n--- MONEYLINE (WINNERS) ---")
print(f"Bets Placed: {wins_ml + losses_ml} (Passed on {passes_ml})")
print(f"Wins: {wins_ml} | Losses: {losses_ml}")
if (wins_ml + losses_ml) > 0: print(f"Win %: {wins_ml / (wins_ml + losses_ml):.1%}")

