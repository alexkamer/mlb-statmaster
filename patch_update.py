import re

with open('update_data.py', 'r') as f:
    content = f.read()

# 1. Insert the extra_stats block right before '# 3. BOXSCORES'
extra_stats_block = """
                    # 2.5 Extract extra stats (d, t, sb) from team details
                    extra_stats = {}
                    
                    def _parse_detail_str(text_str):
                        import re
                        res = {}
                        for p in text_str.split(';'):
                            m = re.match(r'^\\s*([A-Za-z\\-\\.\\'\\s\\,]+?)\\s*(?:(\\d+)\\s*)?\\(', p)
                            if m:
                                name = m.group(1).strip()
                                count = int(m.group(2)) if m.group(2) else 1
                                res[name] = count
                        return res
                        
                    name_to_id = {}
                    for p_team in data.get('boxscore', {}).get('players', []):
                        for stat in p_team.get('statistics', []):
                            for ath in stat.get('athletes', []):
                                short = ath.get('athlete', {}).get('shortName', '')
                                last = short.split(' ')[-1] if ' ' in short else short
                                aid = safe_int(ath.get('athlete', {}).get('id'))
                                if aid:
                                    name_to_id[last.lower()] = aid
                                    name_to_id[short.lower()] = aid
                                    name_to_id[ath.get('athlete', {}).get('displayName', '').lower()] = aid

                    for t_box in data.get('boxscore', {}).get('teams', []):
                        for detail in t_box.get('details', []):
                            if detail.get('name') == 'battingDetails':
                                for stat in detail.get('stats', []):
                                    if stat.get('name') in ['doubles', 'triples', 'stolenBases']:
                                        parsed = _parse_detail_str(stat.get('displayValue', ''))
                                        for name, count in parsed.items():
                                            matched_id = None
                                            for k, v in name_to_id.items():
                                                if name.lower() in k or k in name.lower():
                                                    matched_id = v
                                                    break
                                            if matched_id:
                                                if matched_id not in extra_stats: extra_stats[matched_id] = {'d':0, 't':0, 'sb':0}
                                                if stat.get('name') == 'doubles': extra_stats[matched_id]['d'] = max(extra_stats[matched_id]['d'], count)
                                                if stat.get('name') == 'triples': extra_stats[matched_id]['t'] = max(extra_stats[matched_id]['t'], count)
                                                if stat.get('name') == 'stolenBases': extra_stats[matched_id]['sb'] = max(extra_stats[matched_id]['sb'], count)

                    # Also augment from plays for d and t (more accurate because of IDs)
                    for play in data.get('plays', []):
                        ptype = play.get('type', {}).get('text', '')
                        if ptype in ['Double', 'Triple']:
                            for p in play.get('participants', []):
                                if p.get('type') == 'batter':
                                    aid = safe_int(p.get('athlete', {}).get('id'))
                                    if aid:
                                        if aid not in extra_stats: extra_stats[aid] = {'d':0, 't':0, 'sb':0}
                                        if ptype == 'Double': extra_stats[aid]['d'] += 1
                                        if ptype == 'Triple': extra_stats[aid]['t'] += 1
                    
                    # 3. BOXSCORES
"""
content = content.replace("                    # 3. BOXSCORES", extra_stats_block)

# 2. Add 'd', 't', 'sb' to global_batting.append
batting_append = """
                                        'k': safe_int(stat_dict.get('K')),
                                        'pitches_faced': safe_int(stat_dict.get('#P')),
                                        'd': extra_stats.get(athlete_id, {}).get('d', 0),
                                        't': extra_stats.get(athlete_id, {}).get('t', 0),
                                        'sb': extra_stats.get(athlete_id, {}).get('sb', 0)
"""
content = content.replace("""
                                        'k': safe_int(stat_dict.get('K')),
                                        'pitches_faced': safe_int(stat_dict.get('#P'))""", batting_append)

# 3. Add to astype list
content = content.replace(
    "['position_id', 'ab', 'r', 'h', 'rbi', 'hr', 'bb', 'k', 'pitches_faced']",
    "['position_id', 'ab', 'r', 'h', 'rbi', 'hr', 'bb', 'k', 'pitches_faced', 'd', 't', 'sb']"
)

with open('update_data.py', 'w') as f:
    f.write(content)
