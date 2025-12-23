import os
import sys
from supabase import create_client, Client

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from dotenv import load_dotenv

# Load env from root
env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
load_dotenv(env_path)

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")

print(f"Using key starting with: {key[:10]}...") 

if not url or not key:
    print("Error: SUPABASE_URL or SUPABASE_KEY not found in .env")
    sys.exit(1)

supabase: Client = create_client(url, key)

buckets = [
    {"id": "uploads", "public": False},
    {"id": "data", "public": False},
    {"id": "output", "public": False},
    {"id": "prompts", "public": False},
    {"id": "images", "public": True} # Public for frontend display
]

def init_buckets():
    print("Initializing Supabase Buckets...")
    existing_buckets = supabase.storage.list_buckets()
    existing_ids = [b.id for b in existing_buckets]

    for bucket in buckets:
        if bucket["id"] not in existing_ids:
            print(f"Creating bucket: {bucket['id']} (Public: {bucket['public']})")
            try:
                res = supabase.storage.create_bucket(bucket["id"], options={"public": bucket["public"]})
                print(f"✓ Created {bucket['id']}")
            except Exception as e:
                print(f"✗ Failed to create {bucket['id']}: {e}")
        else:
            print(f"✓ Bucket {bucket['id']} already exists")
            # Ideally verify public status, but simplified for now

if __name__ == "__main__":
    init_buckets()
