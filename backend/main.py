from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import database
from routers import teams, games, players, props, stats, search

app = FastAPI(title="MLB Statmaster API")

# Allow the React frontend to make requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await database.connect()

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()

app.include_router(teams.router)
app.include_router(games.router)
app.include_router(players.router)
app.include_router(props.router)
app.include_router(stats.router)
app.include_router(search.router)
