from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Body
from typing import List
from ..auth import get_current_user
from ..supabase_client import supabase
from ..services.gemini_service import GeminiService

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])

async def run_pipeline_task(job_id: str, brand_id: str, product_ids: List[str], modes: List[str]):
    """
    Background task to run pipeline.
    """
    try:
        service = GeminiService(brand_id)
        
        # Update job status
        supabase.table("pipeline_jobs").update({"status": "running"}).eq("id", job_id).execute()
        
        processed_count = 0
        for pid in product_ids:
            # Fetch full product data (the whole row)
            p_response = supabase.table("products").select("*").eq("brand_id", brand_id).eq("product_id", pid).execute()
            if p_response.data:
                product_data = p_response.data[0]
                if not product_data:
                     # Fallback 
                     product_data = {"product_id": pid}
                     
                await service.process_product(product_data, modes)
                
            processed_count += 1
            # Update progress
            supabase.table("pipeline_jobs").update({"progress": processed_count}).eq("id", job_id).execute()
            
        supabase.table("pipeline_jobs").update({"status": "completed", "completed_at": "now()"}).eq("id", job_id).execute()
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        supabase.table("pipeline_jobs").update({"status": "failed", "error": str(e)}).eq("id", job_id).execute()

@router.post("/run")
async def run_pipeline(
    background_tasks: BackgroundTasks,
    payload: dict = Body(...),
    user=Depends(get_current_user)
):
    """
    Start a pipeline job.
    """
    try:
        brand_id = payload.get("brand_id")
        product_ids = payload.get("product_ids", [])
        modes = payload.get("modes", ['ecommerce', 'lookbook'])
        
        if not brand_id or not product_ids:
             raise HTTPException(status_code=400, detail="brand_id and product_ids required")
             
        # Create Job
        job_data = {
            "brand_id": brand_id,
            "status": "pending",
            "total_products": len(product_ids),
            "progress": 0,
            "product_ids": product_ids 
        }
        response = supabase.table("pipeline_jobs").insert(job_data).execute()
        job_id = response.data[0]['id']
        
        # Start Background Task
        background_tasks.add_task(run_pipeline_task, job_id, brand_id, product_ids, modes)
        
        return {"success": True, "job_id": job_id}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/jobs")
async def list_jobs(brand_id: str, user=Depends(get_current_user)):
    try:
        response = supabase.table("pipeline_jobs").select("*").eq("brand_id", brand_id).order("started_at", desc=True).limit(20).execute()
        return {"jobs": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/product-status/{product_id}")
async def get_product_processing_status(product_id: str, brand_id: str, user=Depends(get_current_user)):
    """
    Check if a specific product is currently being processed in any active job.
    """
    try:
        # Get all active jobs (pending or running) for this brand
        response = supabase.table("pipeline_jobs").select("*").eq("brand_id", brand_id).in_("status", ["pending", "running"]).execute()
        
        is_processing = False
        active_jobs = []
        
        if response.data:
            for job in response.data:
                # Check if this product is in the job's product list
                # product_ids column is expected to be a JSON array of strings
                job_product_ids = job.get('product_ids', [])
                if job_product_ids and product_id in job_product_ids:
                    is_processing = True
                    active_jobs.append(job)
        
        return {"is_processing": is_processing, "active_jobs": active_jobs}
    except Exception as e:
        # Fallback to safe False if schema issue
        print(f"Error checking status: {e}")
        return {"is_processing": False, "error": str(e)}
