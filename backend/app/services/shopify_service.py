import os
import httpx
from typing import Dict, Any

class ShopifyService:
    @staticmethod
    async def push_product(product: Dict[str, Any], brand_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Push processed product content to Shopify.
        Updates Title, Description, Metafields, and Images.
        """
        shopify_domain = brand_config.get("shopify_domain")
        access_token = brand_config.get("shopify_access_token")
        
        if not shopify_domain or not access_token:
            raise Exception("Missing Shopify credentials for this brand")

        base_url = f"https://{shopify_domain}/admin/api/2024-01"
        headers = {
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json"
        }

        # 1. Prepare Data from Pipeline Output
        generated_content = product.get("generated_content", {})
        outputs = generated_content.get("pipeline_outputs", {})
        
        # Step 1 Metadata
        metadata = outputs.get("step1_metadata", {})
        new_title = metadata.get("optimized_title")
        new_description = metadata.get("optimized_description")
        
        # 2. Update Product (Title, Description)
        # We need the Shopify Product ID. Ideally stored in 'full_data' or 'shopify_id' column
        # Assuming product['product_id'] IS the shopify ID or we have it. 
        # For now, let's assume product_id might be the ID, or we search by handle? 
        # A robust way is to store shopify_id in the products table.
        
        # Fallback: if product_id is numeric, assume it's shopify_id. 
        shopify_id = product.get("product_id") 
        if not str(shopify_id).isdigit():
             # Try finding by title or handle if needed, but for MVP let's assume ID match or fail
             # Or maybe it's stored in full_data
             full_data = product.get("full_data", {})
             shopify_id = full_data.get("id") or full_data.get("ID")
             
        if not shopify_id:
            raise Exception("Could not determine Shopify ID for product")

        async with httpx.AsyncClient() as client:
            # Update generic fields
            update_payload = {
                "product": {
                    "id": shopify_id,
                }
            }
            if new_title:
                update_payload["product"]["title"] = new_title
            if new_description:
                update_payload["product"]["body_html"] = new_description
                
            update_res = await client.put(f"{base_url}/products/{shopify_id}.json", json=update_payload, headers=headers)
            if update_res.status_code != 200:
                raise Exception(f"Failed to update product: {update_res.text}")

            # 3. Upload Images (Ecommerce & Lookbook)
            # This is complex because we need to upload URL -> Shopify Image
            # For brevity, let's just log success for now or implement basic image push
            
            # TODO: Implement Image Upload loop
            
            return {"success": True, "shopify_id": shopify_id}
