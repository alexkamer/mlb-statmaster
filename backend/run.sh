#!/bin/bash
# Force usage of the uv virtual environment so it finds the 'databases' package we just installed!
../.venv/bin/uvicorn main:app --reload --port 8000
