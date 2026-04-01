#!/bin/bash
source .venv/bin/activate
uv run python update_data.py
uv run python grab_props.py
