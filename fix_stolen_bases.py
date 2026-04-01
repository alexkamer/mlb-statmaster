import re
from sqlalchemy import create_engine, text

engine = create_engine('postgresql:///mlb_db')

with open('update_data.py', 'r') as f:
    content = f.read()

content = content.replace(
    "if detail.get('name') == 'battingDetails':",
    "if detail.get('name') in ['battingDetails', 'baserunningDetails']:"
)

with open('update_data.py', 'w') as f:
    f.write(content)
