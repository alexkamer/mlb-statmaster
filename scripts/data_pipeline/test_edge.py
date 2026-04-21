with open("v5_vegas_implied.py", "r") as f:
    content = f.read()

import re

for edge_test in [0.01, 0.02, 0.03, 0.04, 0.05, 0.06]:
    new_content = re.sub(r'0\.045\)', f'{edge_test})', content)
    new_content = re.sub(r'\+ 0\.045', f'+ {edge_test}', new_content)
    new_content = re.sub(r'0\.04\)', f'{edge_test})', new_content)
    new_content = re.sub(r'\+ 0\.04', f'+ {edge_test}', new_content)
    
    with open(f"v5_edge_{edge_test}.py", "w") as f:
        f.write(new_content)

