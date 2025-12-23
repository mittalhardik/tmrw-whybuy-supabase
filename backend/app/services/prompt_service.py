from ..supabase_client import supabase

class PromptService:
    @staticmethod
    def get_prompt(brand_id: str, prompt_name: str) -> str:
        """
        Get prompt content from DB or Storage.
        """
        # Try DB first
        response = supabase.table("prompts").select("content").eq("brand_id", brand_id).eq("name", prompt_name).execute()
        
        if response.data:
            return response.data[0]['content']
            
        # Fallback to defaults (could be in code or storage global)
        # For now return empty or raise
        return ""

    @staticmethod
    def save_prompt(brand_id: str, prompt_name: str, content: str):
         # Upsert to DB
         data = {
             "brand_id": brand_id,
             "name": prompt_name,
             "content": content
         }
         supabase.table("prompts").upsert(data, on_conflict="brand_id, name").execute()
         
         # Sync to Storage
         supabase.storage.from_("prompts").upload(f"{brand_id}/{prompt_name}.txt", content.encode(), file_options={"upsert": "true"})
