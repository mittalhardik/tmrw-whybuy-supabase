import os
import json
import asyncio
import httpx
from datetime import datetime
from typing import List, Dict, Any, Optional
import google.generativeai as genai
from PIL import Image
import io
from ..supabase_client import supabase
from .prompt_service import PromptService

class GeminiService:
    def __init__(self, brand_id: str):
        self.brand_id = brand_id
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            print("Warning: GOOGLE_API_KEY not found")
        else:
            genai.configure(api_key=api_key)
            self.text_model = genai.GenerativeModel('gemini-3-pro-preview') # Or 2.0-flash-exp if available
            self.image_model = genai.GenerativeModel('gemini-3-pro-image-preview') # For image gen if needed on specific model

    async def download_image(self, url: str) -> Optional[Image.Image]:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=10.0)
                response.raise_for_status()
                img = Image.open(io.BytesIO(response.content))
                if img.mode not in ('RGB', 'RGBA'):
                    img = img.convert('RGB')
                return img
        except Exception as e:
            print(f"Failed to download image {url}: {e}")
            return None

    def extract_json_from_response(self, response_text: str) -> Dict[str, Any]:
        if not response_text:
            return {}
        try:
            return json.loads(response_text)
        except json.JSONDecodeError:
            # Try markdown cleanup
            if "```json" in response_text:
                clean = response_text.split("```json")[1].split("```")[0].strip()
                return json.loads(clean)
            elif "```" in response_text:
                clean = response_text.split("```")[1].split("```")[0].strip()
                return json.loads(clean)
            return {"error": "Failed to parse JSON", "raw": response_text}

    async def generate_content_with_retry(self, content: list, generation_config: Optional[Dict[str, Any]] = None) -> str:
        # Simple retry logic with optional generation config for strict output formatting
        for attempt in range(3):
            try:
                # Run sync generate_content in thread for async compat
                if generation_config:
                    response = await asyncio.to_thread(
                        self.text_model.generate_content, 
                        content,
                        generation_config=generation_config
                    )
                else:
                    response = await asyncio.to_thread(self.text_model.generate_content, content)
                return response.text
            except Exception as e:
                print(f"Generation attempt {attempt+1} failed: {e}")
                await asyncio.sleep(2 * (attempt + 1))
        return ""

    async def _cleanup_previous_data(self, product_id: str):
        """
        Clean up previous generated data before reprocessing.
        Deletes old images from storage and clears generated_content from database.
        """
        print(f"Cleaning up previous data for product: {product_id}")
        
        try:
            # 1. Delete all files from images bucket for this product
            images_path = f"{self.brand_id}/{product_id}"
            try:
                # List all files in the images bucket for this product
                files_response = supabase.storage.from_("images").list(images_path)
                
                # Build list of file paths to delete
                files_to_delete = []
                if files_response:
                    for file_obj in files_response:
                        # Handle both dict and object responses
                        if isinstance(file_obj, dict):
                            file_name = file_obj.get('name')
                        else:
                            file_name = getattr(file_obj, 'name', None)
                        
                        if file_name and file_name != '.emptyFolderPlaceholder':
                            file_path = f"{images_path}/{file_name}"
                            files_to_delete.append(file_path)
                
                # Delete all files at once
                if files_to_delete:
                    print(f"Deleting {len(files_to_delete)} files from images bucket")
                    supabase.storage.from_("images").remove(files_to_delete)
                    print(f"Deleted images: {files_to_delete}")
                else:
                    print("No images to delete")
                    
            except Exception as e:
                print(f"Note: Could not clean images storage (may not exist yet): {e}")
            
            # 2. Delete all files from output bucket for this product
            try:
                files_response = supabase.storage.from_("output").list(images_path)
                
                # Build list of file paths to delete
                files_to_delete = []
                if files_response:
                    for file_obj in files_response:
                        # Handle both dict and object responses
                        if isinstance(file_obj, dict):
                            file_name = file_obj.get('name')
                        else:
                            file_name = getattr(file_obj, 'name', None)
                        
                        if file_name and file_name != '.emptyFolderPlaceholder':
                            file_path = f"{images_path}/{file_name}"
                            files_to_delete.append(file_path)
                
                # Delete all files at once
                if files_to_delete:
                    print(f"Deleting {len(files_to_delete)} files from output bucket")
                    supabase.storage.from_("output").remove(files_to_delete)
                    print(f"Deleted outputs: {files_to_delete}")
                else:
                    print("No output files to delete")
                    
            except Exception as e:
                print(f"Note: Could not clean output storage (may not exist yet): {e}")
            
            # 3. Clear generated_content and reset processed flag in database
            try:
                print(f"DEBUG: Attempting to clear generated_content for shopify_handle='{product_id}', brand_id='{self.brand_id}'")
                
                # First, check if the product exists
                # NOTE: product_id variable actually contains shopify_handle value
                # The database product_id field contains the numeric Shopify ID
                check_result = supabase.table("products").select("id, product_id, shopify_handle, generated_content, processed").eq(
                    "brand_id", self.brand_id
                ).eq("shopify_handle", product_id).execute()
                
                if not check_result.data:
                    print(f"WARNING: No product found with brand_id='{self.brand_id}' and shopify_handle='{product_id}'")
                    print(f"DEBUG: Trying to find product by other fields...")
                    # Try to find by product_id if shopify_handle doesn't match
                    alt_check = supabase.table("products").select("id, product_id, shopify_handle").eq(
                        "brand_id", self.brand_id
                    ).eq("product_id", product_id).execute()
                    
                    if alt_check.data:
                        print(f"DEBUG: Found product by product_id field instead")
                        print(f"  - product_id: {alt_check.data[0].get('product_id')}, shopify_handle: {alt_check.data[0].get('shopify_handle')}")
                    else:
                        # Show all products for debugging
                        all_products = supabase.table("products").select("id, product_id, shopify_handle").eq(
                            "brand_id", self.brand_id
                        ).execute()
                        print(f"DEBUG: Found {len(all_products.data) if all_products.data else 0} products for this brand")
                        if all_products.data:
                            for p in all_products.data[:3]:  # Show first 3
                                print(f"  - product_id: {p.get('product_id')}, shopify_handle: {p.get('shopify_handle')}")
                else:
                    print(f"DEBUG: Found product: id={check_result.data[0].get('id')}, product_id={check_result.data[0].get('product_id')}, has_generated_content={bool(check_result.data[0].get('generated_content'))}, processed={check_result.data[0].get('processed')}")
                
                # Perform the update using shopify_handle
                result = supabase.table("products").update({
                    "generated_content": None,
                    "processed": False,
                    "push_status": None,
                    "pushed_at": None
                }).eq("brand_id", self.brand_id).eq("shopify_handle", product_id).execute()
                
                affected_rows = len(result.data) if result.data else 0
                print(f"Cleared generated_content for product: {product_id} (affected rows: {affected_rows})")
                
                if affected_rows == 0:
                    print(f"WARNING: Database update affected 0 rows - trying with product_id field as fallback")
                    # Fallback: try using product_id field
                    result = supabase.table("products").update({
                        "generated_content": None,
                        "processed": False,
                        "push_status": None,
                        "pushed_at": None
                    }).eq("brand_id", self.brand_id).eq("product_id", product_id).execute()
                    affected_rows = len(result.data) if result.data else 0
                    print(f"Fallback attempt affected {affected_rows} rows")
                    
            except Exception as e:
                print(f"ERROR: Could not clear generated_content in database: {e}")
                import traceback
                traceback.print_exc()
                
        except Exception as e:
            print(f"Warning: Cleanup encountered an error (continuing anyway): {e}")

    async def process_product(self, product_data: dict, modes: List[str] = ['ecommerce', 'lookbook']):
        # Use shopify_handle as the product identifier (but keep field name as product_id)
        product_id = product_data.get('shopify_handle') or product_data.get('product_id')
        print(f"Processing Product: {product_id}")
        
        # Clean up previous data before starting new processing
        await self._cleanup_previous_data(product_id)
        
        # Fetch brand name from database
        brand_name = "Unknown"
        try:
            brand_res = supabase.table("brands").select("name").eq("id", self.brand_id).execute()
            if brand_res.data:
                brand_name = brand_res.data[0].get("name", "Unknown")
        except Exception as e:
            print(f"Warning: Could not fetch brand name: {e}")
        
        # Initialize Result with top-level metadata
        result = {
            "brand": brand_name,
            "product_id": product_id,  # This will contain shopify_handle
            "timestamp": datetime.now().isoformat(),
            "status": "running",
            "source_data": {
                "url": product_data.get("url", ""),
                "tags": product_data.get("tags", ""),
                "title": product_data.get("title", ""),
                "vendor": product_data.get("vendor", ""),
                "category": product_data.get("category", "Uncategorized"),
                "image_urls": product_data.get("image_urls", []),
                "metafields": product_data.get("metafields", {}),
                "product_id": product_id,  # This will contain shopify_handle
                "description": product_data.get("description", ""),
                "product_type": product_data.get("product_type", "")
            },
            "images_processed": 0,
            "pipeline_outputs": {}
        }
        
        try:
            # 0. Download Images - Download ALL product images
            image_urls = product_data.get('image_urls', [])
            images = []
            for url in image_urls:  # Process all images
                img = await self.download_image(url)
                if img:
                    images.append(img)
            
            if not images:
                raise Exception("No valid images found for product")
            
            # Update images_processed count
            result["images_processed"] = len(images)

            # Step 1: Metadata
            print("Step 1: Metadata")
            prompt1_template = PromptService.get_prompt(self.brand_id, "step1_metadata.txt")
            # Fill template (simplified)
            prompt1 = prompt1_template.replace("{product_title}", product_data.get('title', '')) \
                                      .replace("{product_id}", product_id)
            # Just append the whole product data as context if prompt expects it
            prompt1 += f"\n\nContext Product Data: {json.dumps(product_data, default=str)}"
            
            step1_content = [prompt1] + images
            # Enforce JSON output for metadata step
            step1_res_text = await self.generate_content_with_retry(
                step1_content, 
                generation_config={"response_mime_type": "application/json"}
            )
            step1_json = self.extract_json_from_response(step1_res_text)
            result['pipeline_outputs']['step1_metadata'] = step1_json
            
            # Step 2: Attributes (Only for Ecommerce)
            if 'ecommerce' in modes:
                print("Step 2: Attributes")
                prompt2_template = PromptService.get_prompt(self.brand_id, "step2_attributes.txt")
                prompt2 = prompt2_template + f"\n\nMetadata so far: {json.dumps(step1_json)}"
                
                step2_content = [prompt2] + images
                # Enforce JSON output for attributes step
                step2_res_text = await self.generate_content_with_retry(
                    step2_content,
                    generation_config={"response_mime_type": "application/json"}
                )
                step2_json = self.extract_json_from_response(step2_res_text)
                result['pipeline_outputs']['step2_attributes'] = step2_json
                
                # Step 3: E-commerce Prompts
                print("Step 3: E-commerce Prompts")
                prompt3_template = PromptService.get_prompt(self.brand_id, "step3_ecommerce_prompts.txt")
                prompt3 = prompt3_template.replace("{attributes_json}", json.dumps(step2_json)) \
                                          .replace("{metadata_json}", json.dumps(step1_json))
                
                step3_content = [prompt3] + images
                # Enforce JSON output for ecommerce prompts step
                step3_res_text = await self.generate_content_with_retry(
                    step3_content,
                    generation_config={"response_mime_type": "application/json"}
                )
                step3_json = self.extract_json_from_response(step3_res_text)
                result['pipeline_outputs']['step3_ecommerce_prompts'] = step3_json
                
                # Step 4: E-commerce Image Generation
                print("Step 4: E-commerce Images")
                prompt4_template = PromptService.get_prompt(self.brand_id, "ecommerce_image_generation.txt")
                
                # Track which model is used for image generation
                image_generation_model = self.image_model.model_name if hasattr(self.image_model, 'model_name') else "gemini-image-model"
                
                # Generate images in parallel
                image_tasks = []
                
                # Step 3 Loop with Debug
                generated_images_list = []
                
                # Handle potential list response
                if isinstance(step3_json, list):
                    ecommerce_prompts = step3_json
                else:
                    ecommerce_prompts = step3_json.get("image_prompts", [])

                print(f"DEBUG Step 3 Prompts Type: {type(ecommerce_prompts)}")
                print(f"DEBUG Step 3 Prompts Content: {ecommerce_prompts}")

                for item_data in ecommerce_prompts:
                     if not isinstance(item_data, dict):
                         print(f"SKIPPING INVALID ITEM (Not a dict): {item_data}")
                         continue

                     async def gen_image_task(item_data):
                          attr_name = item_data.get('prompt_for_attribute', 'unknown')
                          detailed_prompt = item_data.get('setting', '') + " " + item_data.get('model_description', '')
                          
                          full_prompt = prompt4_template.replace("{detailed_prompt}", detailed_prompt) \
                                                        .replace("{focus_attribute}", attr_name)
                          
                          # 2 Ref Images + Prompt
                          content = images[:2] + [full_prompt]
                          
                          try:
                              # Generate Image (using same chat-like interface but for image model)
                              # Note: Current Gemini API for Python returns generic 'Image Generation' via distinct method?
                              # The legacy code called `generate_content` on `image_gen_model`.
                              response = await asyncio.to_thread(self.image_model.generate_content, content)
                              
                              # Check for image parts
                              if response.parts:
                                  part = response.parts[0]
                                  if hasattr(part, 'inline_data'):
                                      img_data = part.inline_data.data
                                      filename = f"ecommerce_{attr_name.replace(' ', '_')}.png"
                                      path = f"{self.brand_id}/{product_id}/{filename}"
                                      
                                      # Upload to Supabase Storage
                                      supabase.storage.from_("images").upload(path, img_data, file_options={"upsert": "true"})
                                      
                                      # Return public URL (assuming bucket is public or signed URL needed)
                                      public_url = supabase.storage.from_("images").get_public_url(path)
                                      return {
                                          "attribute": attr_name,
                                          "image_path": public_url,
                                          "status": "generated"
                                      }
                          except Exception as e:
                              print(f"Image Gen Failed for {attr_name}: {e}")
                              return {
                                  "attribute": attr_name,
                                  "error": str(e),
                                  "status": "failed"
                              }
                     
                     image_tasks.append(gen_image_task(item_data))
                     
                # Execute all image tasks
                generated_images_results = await asyncio.gather(*image_tasks)
                result['pipeline_outputs']['step4_ecommerce_images'] = {
                    "product_id": product_id,
                    "ecommerce_images": generated_images_results,
                    "generation_method": image_generation_model
                }

            # Step 5: Lookbook Prompts
            if 'lookbook' in modes:
                print("Step 5: Lookbook Prompts")
                prompt5_template = PromptService.get_prompt(self.brand_id, "step5_lookbook_prompts.txt")
                prompt5 = prompt5_template.replace("{metadata_json}", json.dumps(step1_json)) \
                                          .replace("{product_title}", product_data.get('title', ''))
                
                step5_content = [prompt5] + images
                # Enforce JSON output for lookbook prompts step
                step5_res_text = await self.generate_content_with_retry(
                    step5_content,
                    generation_config={"response_mime_type": "application/json"}
                )
                step5_json = self.extract_json_from_response(step5_res_text)
                result['pipeline_outputs']['step5_lookbook_prompts'] = step5_json
                
                # Step 6: Lookbook Image Generation
                print("Step 6: Lookbook Images")
                prompt6_template = PromptService.get_prompt(self.brand_id, "lookbook_image_generation.txt")
                
                lookbook_tasks = []
                
                # Handle potential list response
                if isinstance(step5_json, list):
                    lookbook_prompts = step5_json
                else:
                    lookbook_prompts = step5_json.get("lookbook_prompts", [])

                print(f"DEBUG Step 5 Prompts Type: {type(lookbook_prompts)}")
                print(f"DEBUG Step 5 Prompts Content: {lookbook_prompts}")

                for i, item_data in enumerate(lookbook_prompts):
                    if not isinstance(item_data, dict):
                         print(f"SKIPPING INVALID ITEM (Not a dict): {item_data}")
                         continue

                    async def gen_lookbook_task(item_data, index):
                         scenario_name = item_data.get('scenario_name', f"Scenario {index+1}")
                         # Construct detailed prompt
                         full_prompt_parts = [
                            f"Scenario: {item_data.get('scenario_description', '')}",
                            f"Model & Mood: {item_data.get('model_action_and_mood', '')}",
                            f"Wearing: Product shown in reference images",
                            "Style: Natural lighting, candid moment, high-end fashion photography",
                            "Requirements: Photorealistic, no text or logos"
                         ]
                         detailed_prompt = " ".join(full_prompt_parts)
                         
                         full_prompt = prompt6_template.replace("{detailed_prompt}", detailed_prompt) \
                                                       .replace("{scenario_name}", scenario_name)

                         content = images[:2] + [full_prompt]
                         
                         try:
                             response = await asyncio.to_thread(self.image_model.generate_content, content)
                             
                             if response.parts:
                                 part = response.parts[0]
                                 if hasattr(part, 'inline_data'):
                                     img_data = part.inline_data.data
                                     filename = f"lookbook_{index}_{scenario_name.replace(' ', '_')}.png"
                                     path = f"{self.brand_id}/{product_id}/{filename}"
                                     
                                     supabase.storage.from_("images").upload(path, img_data, file_options={"upsert": "true"})
                                     public_url = supabase.storage.from_("images").get_public_url(path)
                                     
                                     return {
                                         "scenario": scenario_name,
                                         "image_path": public_url,
                                         "status": "generated"
                                     }
                         except Exception as e:
                             print(f"Lookbook Gen Failed for {scenario_name}: {e}")
                             return {
                                 "scenario": scenario_name,
                                 "error": str(e),
                                 "status": "failed"
                             }
                    
                    lookbook_tasks.append(gen_lookbook_task(item_data, i))
                
                lookbook_results = await asyncio.gather(*lookbook_tasks)
                result['pipeline_outputs']['step6_lookbook_images'] = {
                    "lookbook_images": lookbook_results
                }
            
            # Step 7: QA Report
            print("Step 7: QA Report")
            try:
                prompt7_template = PromptService.get_prompt(self.brand_id, "step7_qa.txt")
                
                # Prepare guardrails summary
                guardrails_summary = "All generated content must be factually accurate, visually consistent, benefit-focused, and adhere to specified formatting rules."
                
                # Build QA prompt with all generated assets
                prompt7 = prompt7_template.replace("{source_product_data}", json.dumps(result.get("source_data", {}))) \
                                          .replace("{guardrails_summary}", guardrails_summary) \
                                          .replace("{metadata_json}", json.dumps(result['pipeline_outputs'].get('step1_metadata', {}))) \
                                          .replace("{attributes_json}", json.dumps(result['pipeline_outputs'].get('step2_attributes', {}))) \
                                          .replace("{ecommerce_prompts_json}", json.dumps(result['pipeline_outputs'].get('step3_ecommerce_prompts', {}))) \
                                          .replace("{lookbook_prompts_json}", json.dumps(result['pipeline_outputs'].get('step5_lookbook_prompts', {}))) \
                                          .replace("{product_id}", product_id)
                
                step7_content = [prompt7] + images
                step7_res_text = await self.generate_content_with_retry(
                    step7_content,
                    generation_config={"response_mime_type": "application/json"}
                )
                step7_json = self.extract_json_from_response(step7_res_text)
                result['pipeline_outputs']['step7_qa_report'] = step7_json
            except Exception as e:
                print(f"QA Report generation failed: {e}")
                # Add a default QA report if generation fails
                result['pipeline_outputs']['step7_qa_report'] = {
                    "qa_report_id": f"QA_{product_id}",
                    "overall_status": "Error",
                    "summary": f"QA report generation failed: {str(e)}",
                    "checks": []
                }
            
            result['status'] = 'completed'
            
        except Exception as e:
            print(f"Pipeline Failed: {e}")
            result['status'] = 'failed'
            result['error'] = str(e)
            
        finally:
            self._save_result(product_id, result)
            return result

    def _save_result(self, product_id: str, result: dict):
        # 1. Update DB
        # NOTE: product_id variable actually contains shopify_handle value
        # The database product_id field contains the numeric Shopify ID
        try:
            print(f"DEBUG: Saving result for shopify_handle='{product_id}'")
            
            # Use shopify_handle to match the product
            update_result = supabase.table("products").update({
                "generated_content": result,
                "processed": True if result['status'] == 'completed' else False,
                "processed_at": datetime.now().isoformat()
            }).eq("brand_id", self.brand_id).eq("shopify_handle", product_id).execute()
            
            affected_rows = len(update_result.data) if update_result.data else 0
            print(f"DEBUG: Database update affected {affected_rows} rows")
            
            if affected_rows == 0:
                print(f"WARNING: Failed to save result - trying with product_id field as fallback")
                # Fallback: try using product_id field
                update_result = supabase.table("products").update({
                    "generated_content": result,
                    "processed": True if result['status'] == 'completed' else False,
                    "processed_at": datetime.now().isoformat()
                }).eq("brand_id", self.brand_id).eq("product_id", product_id).execute()
                affected_rows = len(update_result.data) if update_result.data else 0
                print(f"DEBUG: Fallback attempt affected {affected_rows} rows")
                
        except Exception as e:
            print(f"Error updating DB: {e}")
            import traceback
            traceback.print_exc()
        
        # 2. Save to Storage
        try:
            json_content = json.dumps(result, indent=2)
            supabase.storage.from_("output").upload(f"{self.brand_id}/{product_id}/product_data.json", json_content.encode(), file_options={"upsert": "true"})
        except Exception as e:
            print(f"Error updating Storage: {e}")
