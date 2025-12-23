import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.supabase_client import supabase
from app.services.prompt_service import PromptService

def import_prompts(prompts_dir: str, brand_id: str):
    print(f"Importing prompts from {prompts_dir} for brand {brand_id}...")
    
    if not os.path.exists(prompts_dir):
        print(f"Error: Directory {prompts_dir} not found.")
        return

    # List of expected prompts or iter all txt
    files = [f for f in os.listdir(prompts_dir) if f.endswith(".txt")]
    
    success_count = 0
    for filename in files:
        file_path = os.path.join(prompts_dir, filename)
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Name is filename
            name = filename
            
            print(f"Importing {name}...")
            PromptService.save_prompt(brand_id, name, content)
            success_count += 1
            
        except Exception as e:
            print(f"Error importing {filename}: {e}")

    print(f"✓ Imported {success_count} prompts successfully.")

if __name__ == "__main__":
    # Correct path relative to where script is run (usually root)
    # Assumes run from root: python backend/scripts/import_prompts.py
    prompts_dir = "gemini_pipeline v4/prompts"
    
    # We need a brand ID. For now fetch the first brand or TIGC.
    try:
        res = supabase.table("brands").select("id, name").limit(1).execute()
        if not res.data:
            print("No brands found. Please create a brand first.")
            sys.exit(1)
        
        brand = res.data[0]
        print(f"Using Brand: {brand['name']} ({brand['id']})")
        
        import_prompts(prompts_dir, brand['id'])
        
    except Exception as e:
        print(f"Error fetching brands: {e}")
