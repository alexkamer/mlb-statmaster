#!/bin/bash
cd /Users/alexkamer/mlb_webapp
/Users/alexkamer/mlb_webapp/.venv/bin/python scripts/data_pipeline/update_data.py
/Users/alexkamer/mlb_webapp/.venv/bin/python scripts/data_pipeline/grab_props.py
