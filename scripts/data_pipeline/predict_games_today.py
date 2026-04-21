import pandas as pd
import numpy as np
import sqlalchemy
from xgboost import XGBRegressor
import warnings
warnings.filterwarnings('ignore')

engine = sqlalchemy.create_engine("postgresql:///mlb_db")

print("1. Assembling Game & Pitcher Data...")
# Games & Odds
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

query_odds = "SELECT event_id, AVG(over_under) as vegas_ou, AVG(away_money_line) as vegas_away_ml, AVG(home_money_line) as vegas_home_ml FROM event_odds GROUP BY event_id"
df_odds = pd.read_sql(query_odds, engine)
df_games = pd.merge(df_games, df_odds, on='event_id', how='left')

# Drop games missing Vegas Odds for the backtest
df_games = df_games.dropna(subset=['vegas_ou', 'vegas_home_ml', 'vegas_away_ml'])

# Starters
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

# Pitcher Runs Allowed
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
df_p_runs['date'] = pd.to_datetime(df_p_runs['date'], utc=True)
df_p_runs = df_p_runs.sort_values('date')

p_group = df_p_runs.groupby('pitcher_id')
df_p_runs['p_ra_10'] = p_group['runs_allowed'].transform(lambda x: x.shift(1).rolling(10, min_periods=1).mean())
df_p_runs['p_outs_10'] = p_group['outs'].transform(lambda x: x.shift(1).rolling(10, min_periods=1).mean())
# Avoid division by zero
df_p_runs['p_outs_10'] = df_p_runs['p_outs_10'].replace(0, np.nan)
df_p_runs['p_runs_per_out'] = df_p_runs['p_ra_10'] / df_p_runs['p_outs_10']
df_p_runs['p_runs_per_game'] = df_p_runs['p_runs_per_out'] * 27

df_games = pd.merge(df_games, df_p_runs[['event_id', 'pitcher_id', 'p_runs_per_game']], left_on=['event_id', 'home_starter_id'], right_on=['event_id', 'pitcher_id'], how='left')
df_games.rename(columns={'p_runs_per_game': 'home_pitcher_era'}, inplace=True)
df_games = pd.merge(df_games, df_p_runs[['event_id', 'pitcher_id', 'p_runs_per_game']], left_on=['event_id', 'away_starter_id'], right_on=['event_id', 'pitcher_id'], how='left')
df_games.rename(columns={'p_runs_per_game': 'away_pitcher_era'}, inplace=True)

# Team Offense
home_log = df_games[['event_id', 'date', 'home_team_id', 'home_score']].copy()
home_log.columns = ['event_id', 'date', 'team_id', 'runs_scored']
away_log = df_games[['event_id', 'date', 'away_team_id', 'away_score']].copy()
away_log.columns = ['event_id', 'date', 'team_id', 'runs_scored']

df_teams = pd.concat([home_log, away_log]).sort_values('date')
df_teams['runs_scored_last_10'] = df_teams.groupby('team_id')['runs_scored'].transform(lambda x: x.shift(1).rolling(10, min_periods=1).mean())

df_games = pd.merge(df_games, df_teams[['event_id', 'team_id', 'runs_scored_last_10']], left_on=['event_id', 'home_team_id'], right_on=['event_id', 'team_id'], how='left')
df_games.rename(columns={'runs_scored_last_10': 'home_rs_10'}, inplace=True)
df_games = pd.merge(df_games, df_teams[['event_id', 'team_id', 'runs_scored_last_10']], left_on=['event_id', 'away_team_id'], right_on=['event_id', 'team_id'], how='left')
df_games.rename(columns={'runs_scored_last_10': 'away_rs_10'}, inplace=True)

# Park Factors
df_games['venue_id'] = df_games['venue_id'].fillna(0).astype(int)
df_games['park_factor_runs'] = df_games.groupby('venue_id')['total_score'].transform(lambda x: x.shift(1).expanding().mean())

# Fill NaNs with MLB Averages
df_games['home_pitcher_era'] = df_games['home_pitcher_era'].fillna(4.5)
df_games['away_pitcher_era'] = df_games['away_pitcher_era'].fillna(4.5)
df_games['home_rs_10'] = df_games['home_rs_10'].fillna(4.5)
df_games['away_rs_10'] = df_games['away_rs_10'].fillna(4.5)
df_games['park_factor_runs'] = df_games['park_factor_runs'].fillna(9.0)

# --- THE DUAL MODELS ---
# Features for predicting HOME score (Home Batters vs Away Pitcher)
df_games['home_expected_runs'] = (df_games['home_rs_10'] + df_games['away_pitcher_era']) / 2
home_features = ['home_expected_runs', 'home_rs_10', 'away_pitcher_era', 'park_factor_runs']

# Features for predicting AWAY score (Away Batters vs Home Pitcher)
df_games['away_expected_runs'] = (df_games['away_rs_10'] + df_games['home_pitcher_era']) / 2
away_features = ['away_expected_runs', 'away_rs_10', 'home_pitcher_era', 'park_factor_runs']

# Dynamically get TODAY in US Central Time (Baseball Time)
# Since we're doing a historical backtest for April 5, we'll lock it to that date.
target_date_str = '2026-04-05'

# An MLB "day" typically starts around 11:00 AM Eastern (15:00 UTC) and ends at 5:00 AM Eastern the next day.
# Let's cleanly grab 12:00 UTC to 12:00 UTC the next day.
start_date_utc = pd.to_datetime(f"{target_date_str} 12:00:00", utc=True)
end_date_utc = start_date_utc + pd.Timedelta(days=1)

df_past = df_games[df_games['date'] < start_date_utc].dropna(subset=home_features + away_features + ['home_score', 'away_score'])
df_today = df_games[(df_games['date'] >= start_date_utc) & (df_games['date'] < end_date_utc)].dropna(subset=home_features + away_features)

print("2. Training Dual Poisson Models (Home Score & Away Score)...")
model_home = XGBRegressor(n_estimators=100, max_depth=3, learning_rate=0.05, random_state=42, objective='count:poisson')
model_home.fit(df_past[home_features], df_past['home_score'])

model_away = XGBRegressor(n_estimators=100, max_depth=3, learning_rate=0.05, random_state=42, objective='count:poisson')
model_away.fit(df_past[away_features], df_past['away_score'])

print("3. Simulating Today's Games & Finding the 'Top Pick'...")
def calc_implied_prob(american_odds):
    try:
        odds = float(american_odds)
        if odds == 0: return 0.5
        if odds > 0: return 100 / (odds + 100)
        else: return -odds / (-odds + 100)
    except: return 0.5

if len(df_today) == 0:
    print("No complete data found for today's games (Check if Vegas odds are loaded in DB!)")
else:
    df_today['pred_home_lambda'] = model_home.predict(df_today[home_features])
    df_today['pred_away_lambda'] = model_away.predict(df_today[away_features])
    
    print("-" * 85)
    
    print('\n' + '='*85)
    print(f"{'Matchup':<25} | {'Pred Score':<12} | {'Top Pick':<15} | {'Edge %':<8}")
    print('-' * 85)
    
    for _, row in df_today.iterrows():
        lam_h = row['pred_home_lambda']
        lam_a = row['pred_away_lambda']
        
        np.random.seed(42)
        sim_home = np.random.poisson(lam_h, 10000)
        sim_away = np.random.poisson(lam_a, 10000)
        
        valid_games = sim_home != sim_away
        prob_home_win = np.sum(sim_home[valid_games] > sim_away[valid_games]) / np.sum(valid_games) if np.sum(valid_games) > 0 else 0.5
        prob_away_win = 1 - prob_home_win
        
        sim_total = sim_home + sim_away
        vegas_ou = row['vegas_ou'] if not pd.isna(row['vegas_ou']) else 9.0
        prob_over = np.mean(sim_total > vegas_ou)
        prob_under = np.mean(sim_total < vegas_ou)
        
        vh_prob = calc_implied_prob(row['vegas_home_ml'])
        va_prob = calc_implied_prob(row['vegas_away_ml'])
        tot_ml = vh_prob + va_prob
        true_vegas_home = vh_prob / tot_ml if tot_ml > 0 else 0.5
        true_vegas_away = va_prob / tot_ml if tot_ml > 0 else 0.5
        
        true_vegas_over = 0.5
        true_vegas_under = 0.5
        
        edges = {
            'HOME ML': prob_home_win - true_vegas_home,
            'AWAY ML': prob_away_win - true_vegas_away,
            'OVER': prob_over - true_vegas_over,
            'UNDER': prob_under - true_vegas_under
        }
        
        best_bet = max(edges, key=edges.get)
        best_edge = edges[best_bet]
        
        away_team = pd.read_sql(f"SELECT abbreviation FROM season_teams WHERE team_id = {row['away_team_id']} LIMIT 1", engine).iloc[0]['abbreviation']
        home_team = pd.read_sql(f"SELECT abbreviation FROM season_teams WHERE team_id = {row['home_team_id']} LIMIT 1", engine).iloc[0]['abbreviation']
        matchup = f"{away_team} @ {home_team}"
        pred_score = f"{lam_a:.1f} - {lam_h:.1f}"
        
        if best_edge < 0.04:
            best_bet = "PASS"
            
        print(f"{matchup:<25} | {pred_score:<12} | {best_bet:<15} | {best_edge:>6.1%}")