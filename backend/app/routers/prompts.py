from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Dict, Any
from ..auth import get_current_user
from ..supabase_client import supabase
from ..services.prompt_service import PromptService

router = APIRouter(prefix="/api/prompts", tags=["prompts"])

@router.get("/")
async def get_prompts(brand_id: str, user=Depends(get_current_user)):
    """
    Get all prompts for a brand.
    """
    try:
        response = supabase.table("prompts").select("*").eq("brand_id", brand_id).execute()
        return {"prompts": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{name}")
async def get_prompt(brand_id: str, name: str, user=Depends(get_current_user)):
    """
    Get specific prompt.
    """
    try:
        response = supabase.table("prompts").select("*").eq("brand_id", brand_id).eq("name", name).execute()
        if not response.data:
            # Return empty skeleton if not found, or error?
            # Legacy returned default prompts from file.
            pass
            raise HTTPException(status_code=404, detail="Prompt not found")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{name}")
async def update_prompt(
    brand_id: str,
    name: str,
    payload: Dict[str, str] = Body(...),
    user=Depends(get_current_user)
):
    """
    Update prompt content.
    """
    content = payload.get("content")
    if not content:
        raise HTTPException(status_code=400, detail="Content required")
        
    try:
        PromptService.save_prompt(brand_id, name, content)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
