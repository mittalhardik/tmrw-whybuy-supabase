import sys
import os
sys.path.append(os.getcwd())
from app.supabase_client import supabase

try:
    res = supabase.table("pipeline_jobs").select("*").limit(1).execute()
    if res.data:
        print("Keys:", res.data[0].keys())
    else:
        print("No data")
except Exception as e:
    print(e)
