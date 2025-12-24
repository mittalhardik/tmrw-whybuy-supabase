import os
import httpx
from typing import Dict, Any

class ShopifyService:
    @staticmethod
    async def push_product(product: Dict[str, Any], brand_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Push processed product content to Shopify.
        Updates Title, Description, uploads Images to CDN, and syncs metafield.
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
        
        # 2. Determine Shopify Product ID
        shopify_id = product.get("shopify_id") or product.get("product_id")
        if not str(shopify_id).isdigit():
             full_data = product.get("full_data", {})
             shopify_id = full_data.get("id") or full_data.get("ID")
             
        if not shopify_id:
            raise Exception("Could not determine Shopify ID for product")

        async with httpx.AsyncClient(timeout=60.0) as client:
            # 3. Update Product Title & Description
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

            # 4. Upload Images to Shopify CDN (excluding flagged images)
            # Get references to the actual image arrays in generated_content
            ecom_images = outputs.get("step4_ecommerce_images", {}).get("ecommerce_images", [])
            lookbook_images = outputs.get("step6_lookbook_images", {}).get("lookbook_images", [])
            
            images_uploaded = 0
            images_flagged = 0
            
            # Upload e-commerce images and update CDN URLs in place
            if ecom_images:
                for i, img in enumerate(ecom_images):
                    if img.get("flagged", False):
                        images_flagged += 1
                        continue
                        
                    if img.get("status") == "generated" and img.get("image_path"):
                        cdn_url = await ShopifyService._upload_image_to_shopify(
                            client, base_url, headers, shopify_id, img.get("image_path")
                        )
                        if cdn_url:
                            # Update the image object in the original structure
                            outputs["step4_ecommerce_images"]["ecommerce_images"][i]["shopify_cdn_url"] = cdn_url
                            images_uploaded += 1
            
            # Upload lookbook images and update CDN URLs in place
            if lookbook_images:
                for i, img in enumerate(lookbook_images):
                    if img.get("flagged", False):
                        images_flagged += 1
                        continue
                        
                    if img.get("status") == "generated" and img.get("image_path"):
                        cdn_url = await ShopifyService._upload_image_to_shopify(
                            client, base_url, headers, shopify_id, img.get("image_path")
                        )
                        if cdn_url:
                            # Update the image object in the original structure
                            outputs["step6_lookbook_images"]["lookbook_images"][i]["shopify_cdn_url"] = cdn_url
                            images_uploaded += 1
            
            # 5. Upload updated generated_content to custom.ai_generated_content metafield
            import json
            
            # Serialize to JSON string
            generated_content_json = json.dumps(generated_content)
            
            metafield_payload = {
                "metafield": {
                    "namespace": "custom",
                    "key": "ai_generated_content",
                    "value": generated_content_json,
                    "type": "json"
                }
            }
            
            print(f"Uploading metafield to Shopify product {shopify_id}")
            metafield_res = await client.post(
                f"{base_url}/products/{shopify_id}/metafields.json",
                json=metafield_payload,
                headers=headers
            )
            
            print(f"Metafield response status: {metafield_res.status_code}")
            if metafield_res.status_code not in [200, 201]:
                error_text = metafield_res.text
                print(f"Metafield upload failed: {error_text}")
                raise Exception(f"Failed to update metafield: {error_text}")
            
            print("Metafield uploaded successfully")
            
            return {
                "success": True, 
                "shopify_id": shopify_id,
                "images_uploaded": images_uploaded,
                "images_flagged": images_flagged,
                "metafield_synced": True,
                "updated_generated_content": generated_content  # Return updated content
            }
    
    @staticmethod
    async def _upload_image_to_shopify(
        client: httpx.AsyncClient,
        base_url: str,
        headers: Dict[str, str],
        shopify_id: str,
        image_path: str
    ) -> str:
        """
        Upload a single image to Shopify and return the CDN URL.
        
        Args:
            client: HTTP client instance
            base_url: Shopify API base URL
            headers: Request headers with auth token
            shopify_id: Shopify product ID
            image_path: Local or remote path to the image
            
        Returns:
            Shopify CDN URL of the uploaded image
        """
        import base64
        import os
        
        try:
            # Check if image_path is a URL or local file
            if image_path.startswith("http://") or image_path.startswith("https://"):
                # Remote image - download it first, then upload as base64
                print(f"Downloading remote image: {image_path}")
                download_res = await client.get(image_path)
                
                if download_res.status_code != 200:
                    print(f"Failed to download image from {image_path}: {download_res.status_code}")
                    return None
                
                img_data = base64.b64encode(download_res.content).decode("utf-8")
                
                # Get filename from URL or use default
                filename = os.path.basename(image_path.split('?')[0]) or "image.png"
                
                image_payload = {
                    "image": {
                        "attachment": img_data,
                        "filename": filename
                    }
                }
            else:
                # Local file - read and encode as base64
                print(f"Reading local file: {image_path}")
                if not os.path.exists(image_path):
                    print(f"Local file not found: {image_path}")
                    return None
                    
                with open(image_path, "rb") as img_file:
                    img_data = base64.b64encode(img_file.read()).decode("utf-8")
                    
                image_payload = {
                    "image": {
                        "attachment": img_data,
                        "filename": os.path.basename(image_path)
                    }
                }
            
            # Upload image to Shopify
            print(f"Uploading image to Shopify product {shopify_id}")
            upload_res = await client.post(
                f"{base_url}/products/{shopify_id}/images.json",
                json=image_payload,
                headers=headers
            )
            
            if upload_res.status_code in [200, 201]:
                response_data = upload_res.json()
                cdn_url = response_data.get("image", {}).get("src")
                print(f"Successfully uploaded image, CDN URL: {cdn_url}")
                return cdn_url
            else:
                print(f"Failed to upload image {image_path}: Status {upload_res.status_code}, Response: {upload_res.text}")
                return None
                
        except Exception as e:
            import traceback
            print(f"Error uploading image {image_path}: {str(e)}")
            traceback.print_exc()
            return None

