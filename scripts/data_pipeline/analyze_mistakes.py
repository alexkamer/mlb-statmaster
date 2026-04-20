import pandas as pd
import numpy as np
import sqlalchemy
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error

# Use the exact same query as our V3 Advanced model to keep consistency
print("1. Running XGBoost Model (Takes a few seconds)...")
engine = sqlalchemy.create_engine("postgresql:///mlb_db")

# Pitchers
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
    except:
        return 0

df_p['outs'] = df_p['ip'].apply(calc_outs)
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

df_model['date'] = pd.to_datetime(df_model['date'], utc=True)
df_model['is_day_game'] = (df_model['date'].dt.hour < 22).astype(int)
df_model['is_home'] = (df_model['home_away'] == 'home').astype(int)

final_features = [
    'expected_base_k', 'p_recent_pitches', 'lineup_k_rate', 'lineup_bb_rate', 
    'lineup_pitches_per_pa', 'vegas_ou', 'pitcher_moneyline', 'is_day_game', 'is_home'
]
df_model = df_model.replace([np.inf, -np.inf], np.nan)
df_model = df_model.dropna(subset=final_features + ['target_k'])

X = df_model[final_features]
y = df_model['target_k']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)

# NEW: XGBoost
model = XGBRegressor(n_estimators=100, max_depth=4, learning_rate=0.05, random_state=42)
model.fit(X_train, y_train)

# Analyze the mistakes!
test_results = df_model.loc[X_test.index].copy()
test_results['predicted_k'] = model.predict(X_test)
test_results['error'] = test_results['predicted_k'] - test_results['target_k']
test_results['abs_error'] = test_results['error'].abs()

mae = mean_absolute_error(y_test, test_results['predicted_k'])

print(f"\n✅ New XGBoost Baseline MAE: {mae:.3f} Ks\n")
print("=========================================")
print("  🔍 THE BLIND SPOT TEST (Where we fail)")
print("=========================================\n")

print("1. THE BIGGEST MISSES (Top 5 games we got completely wrong):")
print(test_results[["abs_error", 'date', 'pitcher_name', 'target_k', 'predicted_k', 'error']].sort_values('abs_error', ascending=False).head(5).to_string(index=False))

print("\n2. DO WE OVER-PREDICT OR UNDER-PREDICT ELITE PITCHERS?")
elite_pitchers = test_results[test_results['p_recent_k'] >= 7.5] # Pitchers averaging 7.5+ Ks
avg_error_elite = elite_pitchers['error'].mean()
print(f"When a pitcher averages 7.5+ Ks, we are off by {avg_error_elite:+.2f} Ks on average.")
if avg_error_elite < 0:
    print("-> CONCLUSION: We consistently UNDER-predict aces. They get more Ks than our math thinks.")
else:
    print("-> CONCLUSION: We consistently OVER-predict aces. They let us down.")

print("\n3. THE 'OPENER' PROBLEM (Short Leash)")
openers = test_results[test_results['p_recent_pitches'] <= 50] # Pitchers averaging under 50 pitches
avg_error_openers = openers['error'].mean()
print(f"When a 'starter' averages <50 pitches, we are off by {avg_error_openers:+.2f} Ks.")
if avg_error_openers > 0:
    print("-> CONCLUSION: We OVER-predict Openers. The model doesn't fully understand they will get pulled early.")

print("\n4. ARE WE PREDICTING SHUTOUTS WRONG?")
# Let's see if the Vegas OU correlates to our error
low_ou = test_results[test_results['vegas_ou'] <= 7.5]
high_ou = test_results[test_results['vegas_ou'] >= 10.5]
print(f"Low Scoring Vegas Games (OU < 7.5) MAE: {low_ou['abs_error'].mean():.2f}")
print(f"High Scoring Vegas Games (OU > 10.5) MAE: {high_ou['abs_error'].mean():.2f}")

