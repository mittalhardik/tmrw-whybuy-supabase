from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from ..auth import get_current_user
from ..supabase_client import supabase
from ..services.shopify_service import ShopifyService
from pydantic import BaseModel

router = APIRouter(prefix="/api/products", tags=["products"])

class PushPayload(BaseModel):
    product_id: str
    brand_id: str

@router.post("/push")
async def push_to_shopify(payload: PushPayload, user=Depends(get_current_user)):
    """
    Push processed product data to Shopify.
    """
    try:
        # 1. Fetch Product
        p_res = supabase.table("products").select("*").eq("id", payload.product_id).eq("brand_id", payload.brand_id).execute()
        if not p_res.data:
            raise HTTPException(status_code=404, detail="Product not found")
        product = p_res.data[0]

        # 2. Fetch Brand Config (Shopify Creds)
        b_res = supabase.table("brands").select("*").eq("id", payload.brand_id).execute()
        if not b_res.data:
            raise HTTPException(status_code=404, detail="Brand not found")
        brand_config = b_res.data[0].get("shopify_config", {})

        # 3. Push to Shopify
        result = await ShopifyService.push_product(product, brand_config)
        
        # 4. Update Status and generated_content with CDN URLs
        update_data = {
            "push_status": "pushed",
            "pushed_at": "now()",
            "metafield_synced_at": "now()"
        }
        
        # If CDN URLs were added, update generated_content
        if result.get("updated_generated_content"):
            update_data["generated_content"] = result["updated_generated_content"]
        
        supabase.table("products").update(update_data).eq("id", payload.product_id).execute()

        return {"success": True, "details": result}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("")
async def list_products(
    brand_id: str,
    page: int = 1,
    limit: int = 50,
    search: Optional[str] = None,
    vendor: Optional[str] = None,
    product_type: Optional[str] = None, # Was 'collection'
    processed: Optional[bool] = None,
    push_status: Optional[str] = None, # NEW
    user=Depends(get_current_user)
):
    """
    List products with filtering and pagination.
    """
    try:
        query = supabase.table("products").select("*", count="exact").eq("brand_id", brand_id)
        
        if search:
            query = query.ilike("title", f"%{search}%")
        if vendor:
            query = query.eq("vendor", vendor)
        if product_type:
            query = query.eq("product_type", product_type)
        if processed is not None:
            query = query.eq("processed", processed)
        if push_status:
            if push_status == 'pending':
                # Pending can be explicit 'pending' or NULL (default)
                query = query.or_("push_status.eq.pending,push_status.is.null")
            else:
                query = query.eq("push_status", push_status)
            
        # Pagination
        start = (page - 1) * limit
        end = start + limit - 1
        query = query.range(start, end).order("uploaded_at", desc=True)
        
        response = query.execute()
        
        return {
            "products": response.data,
            "total": response.count,
            "page": page,
            "limit": limit
        }
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))


@router.get("/{product_id}")
async def get_product(product_id: str, brand_id: str, user=Depends(get_current_user)):
    """
    Get single product details.
    """
    try:
        response = supabase.table("products").select("*").eq("product_id", product_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Product not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting product {product_id}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{product_id}/flag-image")
async def flag_image(
    product_id: str, 
    payload: dict,
    brand_id: str = Query(...),
    user=Depends(get_current_user)
):
    """
    Flag or unflag a generated image (ecommerce or lookbook).
    Automatically updates product-level flagged status.
    """
    from ..services.flag_service import FlagImagePayload, flag_product_image
    
    try:
        # Parse payload
        flag_payload = FlagImagePayload(**payload)
        
        # Call service
        result = await flag_product_image(product_id, flag_payload, brand_id, user)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
