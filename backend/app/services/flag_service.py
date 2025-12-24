"""
Image flagging models and endpoint for products router
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from ..auth import get_current_user
from ..supabase_client import supabase


class FlagImagePayload(BaseModel):
    """Payload for flagging/unflagging generated images"""
    image_type: str  # 'ecommerce' or 'lookbook'
    image_index: int
    flagged: bool = True


async def flag_product_image(
    product_id: str,
    payload: FlagImagePayload,
    brand_id: str,
    user
):
    """
    Flag or unflag a generated image (ecommerce or lookbook)
    
    Args:
        product_id: Product UUID
        payload: Flag image payload
        brand_id: Brand UUID
        user: Authenticated user
        
    Returns:
        Updated product with flag status
    """
    # Validate image type
    if payload.image_type not in ['ecommerce', 'lookbook']:
        raise HTTPException(
            status_code=400, 
            detail="Invalid image_type. Must be 'ecommerce' or 'lookbook'"
        )
    
    # Fetch product
    response = supabase.table("products").select("*").eq("id", product_id).eq("brand_id", brand_id).execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product = response.data[0]
    generated_content = product.get("generated_content", {})
    
    if not generated_content:
        raise HTTPException(status_code=400, detail="Product has no generated content")
    
    # Navigate to the correct images array
    pipeline_outputs = generated_content.get("pipeline_outputs", {})
    
    if payload.image_type == 'ecommerce':
        step_data = pipeline_outputs.get("step4_ecommerce_images", {})
        images = step_data.get("ecommerce_images", [])
    else:  # lookbook
        step_data = pipeline_outputs.get("step6_lookbook_images", {})
        images = step_data.get("lookbook_images", [])
    
    # Validate image index
    if not (0 <= payload.image_index < len(images)):
        raise HTTPException(status_code=400, detail=f"Invalid image_index. Must be between 0 and {len(images)-1}")
    
    # Update flag status
    images[payload.image_index]["flagged"] = payload.flagged
    
    # Update the generated_content in place
    if payload.image_type == 'ecommerce':
        pipeline_outputs["step4_ecommerce_images"]["ecommerce_images"] = images
    else:
        pipeline_outputs["step6_lookbook_images"]["lookbook_images"] = images
    
    generated_content["pipeline_outputs"] = pipeline_outputs
    
    # Check if ANY image is flagged (for product-level flag)
    has_flagged_images = False
    
    # Check ecommerce images
    ecom_images = pipeline_outputs.get("step4_ecommerce_images", {}).get("ecommerce_images", [])
    for img in ecom_images:
        if img.get("flagged", False):
            has_flagged_images = True
            break
    
    # Check lookbook images if not already flagged
    if not has_flagged_images:
        lookbook_images = pipeline_outputs.get("step6_lookbook_images", {}).get("lookbook_images", [])
        for img in lookbook_images:
            if img.get("flagged", False):
                has_flagged_images = True
                break
    
    # Update product in database
    update_data = {
        "generated_content": generated_content,
        "flagged": has_flagged_images
    }
    
    update_response = supabase.table("products").update(update_data).eq("id", product_id).execute()
    
    if not update_response.data:
        raise HTTPException(status_code=500, detail="Failed to update product")
    
    return {
        "success": True,
        "message": f"Image {'flagged' if payload.flagged else 'unflagged'} successfully",
        "product": update_response.data[0],
        "has_flagged_images": has_flagged_images
    }
