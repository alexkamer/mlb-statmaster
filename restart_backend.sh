#!/bin/bash
pkill -f "uvicorn main:app" || true
cd backend
nohup ../.venv/bin/uvicorn main:app --reload --port 8000 > backend.log 2>&1 &
echo "Restarted backend on port 8000"
