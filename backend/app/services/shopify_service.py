import os
import httpx
from typing import Dict, Any

class ShopifyService:
    @staticmethod
    async def push_product(product: Dict[str, Any], brand_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Push processed product content to Shopify.
        ONLY uploads Images to CDN and syncs metafield - does NOT modify product title/description.
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
        
        # 2. Determine Shopify Product ID
        shopify_id = product.get("shopify_id") or product.get("product_id")
        if not str(shopify_id).isdigit():
             full_data = product.get("full_data", {})
             shopify_id = full_data.get("id") or full_data.get("ID")
             
        if not shopify_id:
            raise Exception("Could not determine Shopify ID for product")

        async with httpx.AsyncClient(timeout=60.0) as client:
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
                            print(f"Inserting CDN URL into ecommerce image {i}: {cdn_url}")
                            outputs["step4_ecommerce_images"]["ecommerce_images"][i]["shopify_cdn_url"] = cdn_url
                            images_uploaded += 1
                        else:
                            print(f"Warning: No CDN URL returned for ecommerce image {i}")
            
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
                            print(f"Inserting CDN URL into lookbook image {i}: {cdn_url}")
                            outputs["step6_lookbook_images"]["lookbook_images"][i]["shopify_cdn_url"] = cdn_url
                            images_uploaded += 1
                        else:
                            print(f"Warning: No CDN URL returned for lookbook image {i}")
            
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
            print(f"Generated content preview (first 500 chars): {generated_content_json[:500]}...")
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
        Upload a single image to Shopify's general CDN bucket using Files API.
        This does NOT add the image to the product's catalogue imagery.
        
        Args:
            client: HTTP client instance
            base_url: Shopify API base URL
            headers: Request headers with auth token
            shopify_id: Shopify product ID (not used for Files API, kept for compatibility)
            image_path: Local or remote path to the image
            
        Returns:
            Shopify CDN URL of the uploaded image
        """
        import os
        import mimetypes
        
        try:
            # Step 1: Get image data and filename
            if image_path.startswith("http://") or image_path.startswith("https://"):
                # Remote image - download it first
                print(f"Downloading remote image: {image_path}")
                download_res = await client.get(image_path)
                
                if download_res.status_code != 200:
                    print(f"Failed to download image from {image_path}: {download_res.status_code}")
                    return None
                
                image_data = download_res.content
                filename = os.path.basename(image_path.split('?')[0]) or "image.png"
            else:
                # Local file - read it
                print(f"Reading local file: {image_path}")
                if not os.path.exists(image_path):
                    print(f"Local file not found: {image_path}")
                    return None
                    
                with open(image_path, "rb") as img_file:
                    image_data = img_file.read()
                filename = os.path.basename(image_path)
            
            # Determine MIME type
            mime_type, _ = mimetypes.guess_type(filename)
            if not mime_type:
                mime_type = "image/png"  # Default fallback
            
            file_size = len(image_data)
            
            # Step 2: Create staged upload target using GraphQL
            print(f"Creating staged upload for {filename}")
            graphql_url = base_url.replace("/admin/api/2024-01", "/admin/api/2024-01/graphql.json")
            
            staged_upload_mutation = """
            mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
              stagedUploadsCreate(input: $input) {
                stagedTargets {
                  url
                  resourceUrl
                  parameters {
                    name
                    value
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }
            """
            
            staged_upload_variables = {
                "input": [{
                    "resource": "IMAGE",
                    "filename": filename,
                    "mimeType": mime_type,
                    "fileSize": str(file_size),
                    "httpMethod": "POST"
                }]
            }
            
            staged_res = await client.post(
                graphql_url,
                json={"query": staged_upload_mutation, "variables": staged_upload_variables},
                headers=headers
            )
            
            if staged_res.status_code != 200:
                print(f"Failed to create staged upload: {staged_res.status_code}, {staged_res.text}")
                return None
            
            staged_data = staged_res.json()
            print(f"Staged upload response: {staged_data}")
            
            # Check for actual errors (not just empty list)
            user_errors = staged_data.get("data", {}).get("stagedUploadsCreate", {}).get("userErrors", [])
            if user_errors:  # Only fail if there are actual errors
                print(f"Staged upload errors: {user_errors}")
                return None
            
            # Check if we got staged targets
            staged_targets = staged_data.get("data", {}).get("stagedUploadsCreate", {}).get("stagedTargets", [])
            if not staged_targets:
                print(f"No staged targets in response: {staged_data}")
                return None
            
            staged_target = staged_targets[0]
            upload_url = staged_target["url"]
            resource_url = staged_target["resourceUrl"]
            parameters = {p["name"]: p["value"] for p in staged_target["parameters"]}
            
            # Step 3: Upload file to staged URL
            print(f"Uploading file to staged URL")
            form_data = parameters.copy()
            
            upload_res = await client.post(
                upload_url,
                data=form_data,
                files={"file": (filename, image_data, mime_type)}
            )
            
            if upload_res.status_code not in [200, 201, 204]:
                print(f"Failed to upload to staged URL: {upload_res.status_code}, {upload_res.text}")
                return None
            
            print(f"File uploaded to staged URL successfully, status: {upload_res.status_code}")
            
            # Step 4: Create file record in Shopify using fileCreate mutation
            print(f"Creating file record in Shopify")
            file_create_mutation = """
            mutation fileCreate($files: [FileCreateInput!]!) {
              fileCreate(files: $files) {
                files {
                  ... on GenericFile {
                    id
                    url
                  }
                  ... on MediaImage {
                    id
                    image {
                      url
                      originalSrc
                      transformedSrc
                    }
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }
            """
            
            file_create_variables = {
                "files": [{
                    "alt": filename,
                    "contentType": "IMAGE",
                    "originalSource": resource_url
                }]
            }
            
            file_create_res = await client.post(
                graphql_url,
                json={"query": file_create_mutation, "variables": file_create_variables},
                headers=headers
            )
            
            if file_create_res.status_code != 200:
                print(f"Failed to create file record: {file_create_res.status_code}, {file_create_res.text}")
                return None
            
            file_data = file_create_res.json()
            print(f"File create response: {file_data}")
            
            # Check for user errors
            user_errors = file_data.get("data", {}).get("fileCreate", {}).get("userErrors", [])
            if user_errors:  # Only fail if there are actual errors
                print(f"File create errors: {user_errors}")
                return None
            
            # Extract CDN URL from response
            files = file_data.get("data", {}).get("fileCreate", {}).get("files", [])
            if files and len(files) > 0:
                file_obj = files[0]
                file_id = file_obj.get("id")
                print(f"File object structure: {file_obj}")
                
                # Try to get URL from response first
                cdn_url = None
                
                # Method 1: Direct url field (GenericFile)
                if "url" in file_obj:
                    cdn_url = file_obj["url"]
                    print(f"Found URL via direct field: {cdn_url}")
                
                # Method 2: MediaImage with image.url
                elif "image" in file_obj and file_obj["image"]:
                    image_data = file_obj["image"]
                    # Try url, originalSrc, or transformedSrc
                    cdn_url = image_data.get("url") or image_data.get("originalSrc") or image_data.get("transformedSrc")
                    print(f"Found URL via image field: {cdn_url}")
                
                # Method 3: If URL not immediately available, query for it with retries
                if not cdn_url and file_id:
                    print(f"URL not immediately available, querying for it...")
                    
                    query_mutation = """
                    query getFile($id: ID!) {
                      node(id: $id) {
                        ... on GenericFile {
                          url
                        }
                        ... on MediaImage {
                          image {
                            url
                            originalSrc
                          }
                        }
                      }
                    }
                    """
                    
                    # Retry up to 5 times with increasing delays
                    import time
                    max_retries = 5
                    retry_delays = [1, 2, 3, 4, 5]  # seconds
                    
                    for attempt in range(max_retries):
                        if attempt > 0:
                            print(f"Retry {attempt}/{max_retries-1} after {retry_delays[attempt]}s...")
                        
                        time.sleep(retry_delays[attempt])
                        
                        query_res = await client.post(
                            graphql_url,
                            json={"query": query_mutation, "variables": {"id": file_id}},
                            headers=headers
                        )
                        
                        if query_res.status_code == 200:
                            query_data = query_res.json()
                            node = query_data.get("data", {}).get("node", {})
                            if node:
                                cdn_url = node.get("url")
                                if not cdn_url and node.get("image"):
                                    cdn_url = node["image"].get("url") or node["image"].get("originalSrc")
                                
                                # If we got a URL, break the retry loop
                                if cdn_url:
                                    print(f"Found URL via query retry {attempt}: {cdn_url}")
                                    break
                    
                    if not cdn_url:
                        print(f"CDN URL not available after {max_retries} retries (Shopify still processing)")
                
                if cdn_url:
                    print(f"Successfully uploaded to Shopify CDN: {cdn_url}")
                    return cdn_url
                else:
                    print(f"Could not find URL in file object or via retries")
            else:
                print(f"No files in response")
            
            print(f"Failed to extract CDN URL from response: {file_data}")
            return None
                
        except Exception as e:
            import traceback
            print(f"Error uploading image {image_path}: {str(e)}")
            traceback.print_exc()
            return None

