from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Dict, Any
from pydantic import BaseModel
from ..auth import get_current_user
from ..supabase_client import supabase
from ..services.shopify_sync_service import ShopifySyncService


router = APIRouter(prefix="/api/sync", tags=["sync"])


class SyncProductRequest(BaseModel):
    identifier: str  # Product ID or Handle
    by_handle: bool = False
    brand_id: str


class MetafieldRequest(BaseModel):
    product_id: str  # Supabase product UUID
    brand_id: str


class BatchSyncProductRequest(BaseModel):
    identifiers: list[str]  # List of Product IDs or Handles
    by_handle: bool = False
    brand_id: str


@router.post("/product")
async def sync_product(payload: SyncProductRequest, user=Depends(get_current_user)):
    """
    Add a product from Shopify by ID or handle.
    """
    try:
        # Fetch brand configuration
        brand_response = supabase.table("brands").select("*").eq("id", payload.brand_id).execute()
        if not brand_response.data:
            raise HTTPException(status_code=404, detail="Brand not found")
        
        brand = brand_response.data[0]
        brand_config = brand.get("shopify_config", {})
        
        # Sync product from Shopify
        result = await ShopifySyncService.sync_product(
            identifier=payload.identifier,
            brand_id=payload.brand_id,
            brand_config=brand_config,
            supabase=supabase,
            by_handle=payload.by_handle
        )
        
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid input: {str(e)}")
    except Exception as e:
        error_message = str(e)
        if "not found" in error_message.lower():
            raise HTTPException(status_code=404, detail=error_message)
        elif "credentials" in error_message.lower():
            raise HTTPException(status_code=401, detail=error_message)
        else:
            raise HTTPException(status_code=500, detail=error_message)


@router.post("/products/batch")
async def batch_sync_products(payload: BatchSyncProductRequest, user=Depends(get_current_user)):
    """
    Add multiple products from Shopify by IDs or handles.
    """
    try:
        # Fetch brand configuration
        brand_response = supabase.table("brands").select("*").eq("id", payload.brand_id).execute()
        if not brand_response.data:
            raise HTTPException(status_code=404, detail="Brand not found")
        
        brand = brand_response.data[0]
        brand_config = brand.get("shopify_config", {})
        
        results = []
        successful = 0
        failed = 0
        
        # Process each identifier
        for identifier in payload.identifiers:
            identifier = identifier.strip()
            if not identifier:
                continue
                
            try:
                result = await ShopifySyncService.sync_product(
                    identifier=identifier,
                    brand_id=payload.brand_id,
                    brand_config=brand_config,
                    supabase=supabase,
                    by_handle=payload.by_handle
                )
                
                results.append({
                    "identifier": identifier,
                    "success": True,
                    "product": result.get("product"),
                    "message": f"Product '{result.get('product', {}).get('title', identifier)}' added successfully"
                })
                successful += 1
                
            except Exception as e:
                error_message = str(e)
                results.append({
                    "identifier": identifier,
                    "success": False,
                    "error": error_message,
                    "message": f"Failed to add product: {error_message}"
                })
                failed += 1
        
        return {
            "success": True,
            "results": results,
            "summary": {
                "total": len(results),
                "successful": successful,
                "failed": failed
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/product/{product_id}/refresh")
async def refresh_product(
    product_id: str,
    brand_id: str,
    user=Depends(get_current_user)
):
    """
    Refresh a product's data from Shopify.
    """
    try:
        # Fetch existing product to get shopify_id
        product_response = supabase.table("products").select("*").eq("id", product_id).eq("brand_id", brand_id).execute()
        if not product_response.data:
            raise HTTPException(status_code=404, detail="Product not found")
        
        product = product_response.data[0]
        shopify_id = product.get("shopify_id")
        
        if not shopify_id:
            raise HTTPException(status_code=400, detail="Product does not have a Shopify ID")
        
        # Fetch brand configuration
        brand_response = supabase.table("brands").select("*").eq("id", brand_id).execute()
        if not brand_response.data:
            raise HTTPException(status_code=404, detail="Brand not found")
        
        brand_config = brand_response.data[0].get("shopify_config", {})
        
        # Re-fetch from Shopify and update
        result = await ShopifySyncService.sync_product(
            identifier=str(shopify_id),
            brand_id=brand_id,
            brand_config=brand_config,
            supabase=supabase,
            by_handle=False
        )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/metafield/push")
async def push_metafield(payload: MetafieldRequest, user=Depends(get_current_user)):
    """
    Push AI-generated content to Shopify metafield.
    """
    try:
        # Fetch product from Supabase
        product_response = supabase.table("products").select("*").eq("id", payload.product_id).eq("brand_id", payload.brand_id).execute()
        if not product_response.data:
            raise HTTPException(status_code=404, detail="Product not found")
        
        product = product_response.data[0]
        shopify_id = product.get("shopify_id")
        generated_content = product.get("generated_content")
        
        if not shopify_id:
            raise HTTPException(status_code=400, detail="Product does not have a Shopify ID")
        
        if not generated_content:
            raise HTTPException(status_code=400, detail="Product does not have generated content to push")
        
        # Fetch brand configuration
        brand_response = supabase.table("brands").select("*").eq("id", payload.brand_id).execute()
        if not brand_response.data:
            raise HTTPException(status_code=404, detail="Brand not found")
        
        brand_config = brand_response.data[0].get("shopify_config", {})
        
        # Write metafield to Shopify
        await ShopifySyncService.write_metafield(
            shopify_id=shopify_id,
            content=generated_content,
            brand_config=brand_config
        )
        
        # Update metafield_synced_at in Supabase
        from datetime import datetime
        supabase.table("products").update({
            "metafield_synced_at": datetime.utcnow().isoformat()
        }).eq("id", payload.product_id).execute()
        
        return {
            "success": True,
            "synced_at": datetime.utcnow().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/metafield/pull")
async def pull_metafield(payload: MetafieldRequest, user=Depends(get_current_user)):
    """
    Pull metafield from Shopify and update Supabase.
    """
    try:
        # Fetch product from Supabase
        product_response = supabase.table("products").select("*").eq("id", payload.product_id).eq("brand_id", payload.brand_id).execute()
        if not product_response.data:
            raise HTTPException(status_code=404, detail="Product not found")
        
        product = product_response.data[0]
        shopify_id = product.get("shopify_id")
        
        if not shopify_id:
            raise HTTPException(status_code=400, detail="Product does not have a Shopify ID")
        
        # Fetch brand configuration
        brand_response = supabase.table("brands").select("*").eq("id", payload.brand_id).execute()
        if not brand_response.data:
            raise HTTPException(status_code=404, detail="Brand not found")
        
        brand_config = brand_response.data[0].get("shopify_config", {})
        
        # Read metafield from Shopify
        metafield_content = await ShopifySyncService.read_metafield(
            shopify_id=shopify_id,
            brand_config=brand_config
        )
        
        if metafield_content is None:
            return {
                "success": True,
                "message": "No metafield found in Shopify",
                "content": None
            }
        
        # Update generated_content in Supabase
        from datetime import datetime
        supabase.table("products").update({
            "generated_content": metafield_content,
            "metafield_synced_at": datetime.utcnow().isoformat()
        }).eq("id", payload.product_id).execute()
        
        return {
            "success": True,
            "content": metafield_content,
            "synced_at": datetime.utcnow().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
