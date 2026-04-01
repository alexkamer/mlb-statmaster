import databases
import sqlalchemy

DATABASE_URL = "postgresql:///mlb_db"

database = databases.Database(DATABASE_URL)
metadata = sqlalchemy.MetaData()
