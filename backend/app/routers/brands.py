from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Dict, Any
from ..auth import get_current_user
from ..supabase_client import supabase

router = APIRouter(prefix="/api/brands", tags=["brands"])

@router.get("/")
async def get_brands(user=Depends(get_current_user)):
    """
    Get all available brands.
    """
    try:
        response = supabase.table("brands").select("*").execute()
        return {"brands": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{brand_id}")
async def get_brand(brand_id: str, user=Depends(get_current_user)):
    """
    Get specific brand details.
    """
    try:
        response = supabase.table("brands").select("*").eq("id", brand_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Brand not found")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
async def create_brand(brand: Dict[str, Any] = Body(...), user=Depends(get_current_user)):
    """
    Create a new brand.
    """
    try:
        # TODO: Add validation
        response = supabase.table("brands").insert(brand).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{brand_id}/config")
async def update_brand_config(brand_id: str, config: Dict[str, Any] = Body(...), user=Depends(get_current_user)):
    """
    Update brand configuration (settings/shopify_config).
    """
    try:
        response = supabase.table("brands").update(config).eq("id", brand_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Brand not found")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
