import re
with open("predict_today.py", "r") as f:
    content = f.read()

# Make it output OVER or UNDER and the calculated EDGE
new_loop = """
    print(f"{'Pitcher':<22} | {'Expected K':<10} | {'Vegas O/U':<9} | {'Our Bet':<10} | {'Edge %':<8}")
    print("-" * 65)
    for _, row in df_today.iterrows():
        prop_query = f"SELECT prop_line, over_odds, under_odds FROM player_props WHERE event_id = {row['event_id']} AND athlete_id = {row['pitcher_id']} AND prop_type = 'Total Strikeouts' ORDER BY last_updated DESC LIMIT 1"
        prop_res = pd.read_sql(prop_query, engine)
        if prop_res.empty: continue
        
        real_ou = float(prop_res.iloc[0]['prop_line'])
        lam = row['predicted_lambda'] if 'predicted_lambda' in row else row['predicted_k']
        
        # Poisson Probabilities
        prob_under = poisson.cdf(int(np.floor(real_ou)), mu=lam)
        prob_over = 1 - prob_under
        
        # Vegas Implied
        def calc_implied_prob(american_odds):
            try:
                odds = float(american_odds)
                if odds > 0: return 100 / (odds + 100)
                else: return -odds / (-odds + 100)
            except: return 0.5
            
        vegas_over_prob = calc_implied_prob(prop_res.iloc[0]['over_odds'])
        vegas_under_prob = calc_implied_prob(prop_res.iloc[0]['under_odds'])
        
        total_implied = vegas_over_prob + vegas_under_prob
        if total_implied > 0:
            true_vegas_over_prob = vegas_over_prob / total_implied
            true_vegas_under_prob = vegas_under_prob / total_implied
        else:
            true_vegas_over_prob, true_vegas_under_prob = 0.5, 0.5
            
        bet = "PASS"
        edge = 0
        if prob_over > (true_vegas_over_prob + 0.04): bet = "OVER"; edge = prob_over - true_vegas_over_prob
        elif prob_under > (true_vegas_under_prob + 0.04): bet = "UNDER"; edge = prob_under - true_vegas_under_prob
        else: edge = max(prob_over - true_vegas_over_prob, prob_under - true_vegas_under_prob)
        
        print(f"{row['pitcher_name']:<22} | {lam:<10.1f} | {real_ou:<9.1f} | {bet:<10} | {edge:>6.1%}")
"""

content = re.sub(r'print\(f"\{\'Pitcher\':<22\}.*', new_loop.strip(), content, flags=re.DOTALL)

with open("predict_today.py", "w") as f:
    f.write(content)
