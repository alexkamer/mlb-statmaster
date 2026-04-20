#!/bin/bash
cd /Users/alexkamer/mlb_webapp
/Users/alexkamer/mlb_webapp/.venv/bin/python update_data.py
/Users/alexkamer/mlb_webapp/.venv/bin/python grab_props.py
