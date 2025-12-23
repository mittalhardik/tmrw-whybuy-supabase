from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL", "")
key: str = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY", "")

try:
    if not url or not key:
        print("CRITICAL WARNING: SUPABASE_URL or SUPABASE_KEY is missing from environment variables.")
    
    supabase: Client = create_client(url, key)
except Exception as e:
    print(f"CRITICAL ERROR: Failed to initialize Supabase client: {e}")
    # We might want to re-raise or set supabase to None, but subsequent imports will fail. 
    # Raising is better for Cloud Run to restart, but printing the error first is key for debugging.
    raise e
