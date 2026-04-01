# MLB Statmaster

A high-performance, real-time Major League Baseball analytics web application.

## Tech Stack
- **Frontend:** React, TypeScript, TailwindCSS, Recharts, Vite
- **Backend:** FastAPI, PostgreSQL, HTTPX, AsyncIO
- **Data Source:** ESPN Core API / V2 Scoreboard API

## Architecture
The application is structured using Domain-Driven Design (DDD) to ensure maximum maintainability.

### Frontend (`frontend/src/`)
- `api.ts`: Centralized fetch definitions with in-memory TTL caching.
- `components/`
  - `game/`: Box scores, play-by-play, win probability charts.
  - `league/`: Schedules, league leaders, standings.
  - `player/`: Individual player profiles and game logs.
  - `props/`: Prop bet analysis, batter-vs-pitcher (BvP), and trend charting.
  - `team/`: Roster management, depth charts, and news feeds.
  - `shared/`: Generic components (e.g., `<SafeImage />`, `<LiveTicker />`).

### Backend (`backend/`)
- `main.py`: Application entry point.
- `database.py`: SQLAlchemy and Postgres connection logic.
- `routers/`: Isolated API domains (e.g., `games.py`, `players.py`, `props.py`).

## Data Sync Pipeline
The repository uses ultra-fast asynchronous Python scrapers to fetch live data.
- `uv run python update_data.py`: Fetches all games, boxscores, and win probabilities from the last 48 hours concurrently.
- `uv run python grab_props.py`: Fetches live player prop odds for today's scheduled games.
- These scripts are designed to be run as Cron jobs via `run_grabber.sh`.