from sqlalchemy import create_engine
import pandas as pd
engine = create_engine("postgresql:///mlb_db")
query = "SELECT * FROM events WHERE event_id = 401814817;"
print(pd.read_sql(query, engine))
