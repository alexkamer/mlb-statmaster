def sum_innings_pitched(ip_array):
    """
    Safely sums an array of baseball innings pitched strings (e.g. ['6.1', '5.2', '7.0']).
    1 inning = 3 outs.
    '6.1' = 6 innings + 1 out = 19 outs.
    """
    if not ip_array:
        return "0.0"
        
    total_outs = 0
    for ip in ip_array:
        if not ip or not isinstance(ip, str):
            continue
            
        parts = ip.split('.')
        try:
            full_innings = int(parts[0]) if parts[0] else 0
            outs = int(parts[1]) if len(parts) > 1 and parts[1] else 0
            total_outs += (full_innings * 3) + outs
        except ValueError:
            continue
            
    final_full_innings = total_outs // 3
    final_remainder = total_outs % 3
    return f"{final_full_innings}.{final_remainder}"
