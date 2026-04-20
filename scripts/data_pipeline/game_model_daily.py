with open("score_simulator.py", "r") as f:
    content = f.read()

# Make it predict TODAY instead of doing a massive backtest
import re

logic = """
# Predict Today!
start_date = pd.to_datetime('2026-04-05', utc=True)
end_date = pd.to_datetime('2026-04-06', utc=True)

df_past = df_games[df_games['date'] < start_date].dropna(subset=home_features + away_features + ['home_score', 'away_score'])
df_today = df_games[(df_games['date'] >= start_date) & (df_games['date'] < end_date)].dropna(subset=home_features + away_features)

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
    
    print("\\n" + "="*85)
    print(f"{'Matchup':<25} | {'Pred Score':<12} | {'Top Pick':<15} | {'Edge %':<8}")
    print("-" * 85)
    
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

"""
content = re.sub(r'start_date = pd.to_datetime.*', logic.strip(), content, flags=re.DOTALL)

with open("predict_games_today.py", "w") as f:
    f.write(content)
