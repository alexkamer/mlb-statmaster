import pandas as pd
import numpy as np
import sqlalchemy
from xgboost import XGBRegressor
from scipy.stats import poisson
import warnings
warnings.filterwarnings('ignore')

engine = sqlalchemy.create_engine("postgresql:///mlb_db")
query_pitching = """
SELECT p.event_id, e.date, p.athlete_id as pitcher_id, a.display_name as pitcher_name, 
       p.team_id as pitcher_team_id, c.home_away, a.throws as pitcher_throws,
       p.k as target_k, p.ip, p.pitches, p.bb as bb_allowed, c_opp.team_id as opp_team_id
FROM event_boxscores_pitching p
JOIN events e ON p.event_id = e.event_id
JOIN athletes a ON p.athlete_id = a.athlete_id
JOIN event_competitors c ON p.event_id = c.event_id AND p.team_id = c.team_id
JOIN event_competitors c_opp ON p.event_id = c_opp.event_id AND p.team_id != c_opp.team_id
WHERE p.starter = true AND (e.type_id != 1 OR e.type_id IS NULL)
ORDER BY e.date ASC
"""
df_p = pd.read_sql(query_pitching, engine)

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

df_p['outs'] = df_p['ip'].apply(calc_outs)
df_p['date'] = pd.to_datetime(df_p['date'], utc=True)
df_p = df_p.sort_values('date')

pitcher_group = df_p.groupby('pitcher_id')
df_p['p_recent_outs'] = pitcher_group['outs'].transform(lambda x: x.shift(1).rolling(10, min_periods=1).mean())
df_p['p_recent_k'] = pitcher_group['target_k'].transform(lambda x: x.shift(1).rolling(10, min_periods=1).mean())
df_p['p_recent_pitches'] = pitcher_group['pitches'].transform(lambda x: x.shift(1).rolling(10, min_periods=1).mean())
df_p['p_k_per_out'] = df_p['p_recent_k'] / df_p['p_recent_outs']

opp_group = df_p.groupby('opp_team_id')
df_p['opp_recent_outs_allowed'] = opp_group['outs'].transform(lambda x: x.shift(1).rolling(10, min_periods=1).mean())
df_p['expected_outs'] = (df_p['p_recent_outs'] + df_p['opp_recent_outs_allowed']) / 2
df_p['expected_base_k'] = df_p['expected_outs'] * df_p['p_k_per_out']

query_batting = """
SELECT b.event_id, e.date, b.athlete_id as batter_id, b.team_id as batting_team_id, b.starter as is_starter,
       b.ab, b.bb, b.k, b.pitches_faced, a_p.throws as opp_pitcher_throws
FROM event_boxscores_batting b
JOIN events e ON b.event_id = e.event_id
JOIN event_competitors c_opp ON b.event_id = c_opp.event_id AND b.team_id != c_opp.team_id
JOIN event_boxscores_pitching opp_p ON b.event_id = opp_p.event_id AND c_opp.team_id = opp_p.team_id AND opp_p.starter = true
JOIN athletes a_p ON opp_p.athlete_id = a_p.athlete_id
WHERE (e.type_id != 1 OR e.type_id IS NULL)
ORDER BY e.date ASC
"""
df_b = pd.read_sql(query_batting, engine)
df_b['pa'] = df_b['ab'] + df_b['bb']
df_b['date'] = pd.to_datetime(df_b['date'], utc=True)
df_b = df_b.sort_values('date')

batter_split_group = df_b.groupby(['batter_id', 'opp_pitcher_throws'])
df_b['recent_pa'] = batter_split_group['pa'].transform(lambda x: x.shift(1).rolling(20, min_periods=1).sum())
df_b['recent_k'] = batter_split_group['k'].transform(lambda x: x.shift(1).rolling(20, min_periods=1).sum())
df_b['recent_bb'] = batter_split_group['bb'].transform(lambda x: x.shift(1).rolling(20, min_periods=1).sum())
df_b['recent_pitches'] = batter_split_group['pitches_faced'].transform(lambda x: x.shift(1).rolling(20, min_periods=1).sum())

df_b['batter_k_rate'] = df_b['recent_k'] / df_b['recent_pa']
df_b['batter_bb_rate'] = df_b['recent_bb'] / df_b['recent_pa']
df_b['batter_pitches_per_pa'] = df_b['recent_pitches'] / df_b['recent_pa']

starters_df = df_b[df_b['is_starter'] == True]
lineup_stats = starters_df.groupby(['event_id', 'batting_team_id']).agg(
    lineup_k_rate=('batter_k_rate', 'mean'), lineup_bb_rate=('batter_bb_rate', 'mean'), lineup_pitches_per_pa=('batter_pitches_per_pa', 'mean')
).reset_index()

df_model = pd.merge(df_p, lineup_stats, left_on=['event_id', 'opp_team_id'], right_on=['event_id', 'batting_team_id'], how='inner')

query_odds = "SELECT event_id, AVG(over_under) as vegas_ou, AVG(away_money_line) as vegas_away_ml, AVG(home_money_line) as vegas_home_ml FROM event_odds GROUP BY event_id"
df_odds = pd.read_sql(query_odds, engine)
df_model = pd.merge(df_model, df_odds, on='event_id', how='left')

df_model['pitcher_moneyline'] = np.where(df_model['home_away'] == 'home', df_model['vegas_home_ml'], df_model['vegas_away_ml'])
df_model['vegas_ou'] = df_model['vegas_ou'].fillna(df_model['vegas_ou'].mean())
df_model['pitcher_moneyline'] = df_model['pitcher_moneyline'].fillna(0)

df_model['is_day_game'] = (df_model['date'].dt.hour < 22).astype(int)
df_model['is_home'] = (df_model['home_away'] == 'home').astype(int)
df_model['is_opener'] = (df_model['p_recent_pitches'] < 50).astype(int)
df_model['p_max_k'] = pitcher_group['target_k'].transform(lambda x: x.shift(1).rolling(10, min_periods=1).max())

final_features = [
    'expected_base_k', 'p_recent_pitches', 'lineup_k_rate', 'lineup_bb_rate', 
    'lineup_pitches_per_pa', 'vegas_ou', 'pitcher_moneyline', 'is_day_game', 'is_home',
    'is_opener', 'p_max_k'
]
df_model = df_model.replace([np.inf, -np.inf], np.nan)

# Let's test the entire first week of April 2026 (March 30 to April 5)
start_date = pd.to_datetime('2026-03-26', utc=True) # Opening Day 2026
end_date = pd.to_datetime('2026-04-05', utc=True)

df_past = df_model[df_model['date'] < start_date].dropna(subset=final_features + ['target_k'])
df_test = df_model[(df_model['date'] >= start_date) & (df_model['date'] < end_date)].dropna(subset=final_features + ['target_k'])

print(f"Training on {len(df_past)} historical games...")
model = XGBRegressor(n_estimators=150, max_depth=4, learning_rate=0.05, random_state=42, objective='count:poisson')
model.fit(df_past[final_features], df_past['target_k'])

print(f"Backtesting on {len(df_test)} games from March 26 to April 4...")
df_test['predicted_lambda'] = model.predict(df_test[final_features])

wins, losses, pushes, overs, unders, passes = 0, 0, 0, 0, 0, 0

# Grab all props at once to speed up the loop
prop_query = "SELECT event_id, athlete_id, prop_line FROM player_props WHERE prop_type = 'Total Strikeouts'"
props_df = pd.read_sql(prop_query, engine)
# Keep only the latest line by grouping (hacky but fast for backtest)
props_df = props_df.drop_duplicates(subset=['event_id', 'athlete_id'], keep='last')

df_test = pd.merge(df_test, props_df, left_on=['event_id', 'pitcher_id'], right_on=['event_id', 'athlete_id'], how='inner')

for _, row in df_test.iterrows():
    real_ou = float(row['prop_line'])
    lam = row['predicted_lambda']
    actual_k = row['target_k']
    
    prob_under = poisson.cdf(int(np.floor(real_ou)), mu=lam)
    prob_over = 1 - prob_under
    
    bet = "PASS"
    edge = 0
    # Let's demand a higher edge: 57.5% probability (this guarantees long-term profit against -110 juice)
    if prob_over > 0.575: bet = "OVER"; edge = prob_over; overs += 1
    elif prob_under > 0.575: bet = "UNDER"; edge = prob_under; unders += 1
    else: passes += 1; edge = max(prob_over, prob_under)
        
    if bet == "OVER" and actual_k > real_ou: wins += 1
    elif bet == "UNDER" and actual_k < real_ou: wins += 1
    elif actual_k == real_ou and bet != "PASS": pushes += 1
    elif bet != "PASS": losses += 1

print("\n" + "="*40)
print("💰 10-DAY LARGE SAMPLE BACKTEST SUMMARY")
print("="*40)
print(f"Total Games Analyzed: {len(df_test)}")
print(f"Total Bets Placed: {wins + losses + pushes} (Passed on {passes} games)")
print(f"Overs Bet: {overs} | Unders Bet: {unders}")
print(f"Wins:   {wins}")
print(f"Losses: {losses}")
print(f"Pushes: {pushes}")
if (wins + losses) > 0:
    print(f"Win %:  {wins / (wins+losses):.1%}")
