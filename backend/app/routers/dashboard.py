from fastapi import APIRouter, Depends, HTTPException
from ..auth import get_current_user
from ..supabase_client import supabase

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/stats")
async def get_dashboard_stats(brand_id: str, user=Depends(get_current_user)):
    try:
        # 1. Product Counts
        total_res = supabase.table("products").select("*", count="exact", head=True).eq("brand_id", brand_id).execute()
        total_products = total_res.count

        processed_res = supabase.table("products").select("*", count="exact", head=True).eq("brand_id", brand_id).eq("processed", True).execute()
        processed_products = processed_res.count
        
        pending_products = total_products - processed_products

        # 2. Recent Jobs (Last 5)
        jobs_res = supabase.table("pipeline_jobs").select("*").eq("brand_id", brand_id).order("started_at", desc=True).limit(5).execute()
        recent_jobs = jobs_res.data
        
        # 3. Active Jobs Count
        active_jobs_res = supabase.table("pipeline_jobs").select("*", count="exact", head=True).eq("brand_id", brand_id).eq("status", "running").execute()
        active_jobs_count = active_jobs_res.count

        return {
            "total_products": total_products,
            "processed_products": processed_products,
            "pending_products": pending_products,
            "active_jobs_count": active_jobs_count,
            "recent_jobs": recent_jobs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
