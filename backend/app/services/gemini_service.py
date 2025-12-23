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
            self.text_model = genai.GenerativeModel('gemini-flash-latest') # Or 2.0-flash-exp if available
            self.image_model = genai.GenerativeModel('gemini-2.5-flash-image') # For image gen if needed on specific model

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

    async def generate_content_with_retry(self, content: list) -> str:
        # Simple retry logic
        for attempt in range(3):
            try:
                # Run sync generate_content in thread for async compat
                response = await asyncio.to_thread(self.text_model.generate_content, content)
                return response.text
            except Exception as e:
                print(f"Generation attempt {attempt+1} failed: {e}")
                await asyncio.sleep(2 * (attempt + 1))
        return ""

    async def process_product(self, product_data: dict, modes: List[str] = ['ecommerce', 'lookbook']):
        product_id = product_data.get('product_id')
        print(f"Processing Product: {product_id}")
        
        # Initialize Result
        result = {
            "product_id": product_id,
            "timestamp": datetime.now().isoformat(),
            "status": "running",
            "pipeline_outputs": {}
        }
        
        try:
            # 0. Download Images
            image_urls = product_data.get('image_urls', [])
            images = []
            for url in image_urls[:3]: # Limit to 3 images for analysis to save tokens
                img = await self.download_image(url)
                if img:
                    images.append(img)
            
            if not images:
                raise Exception("No valid images found for product")

            # Step 1: Metadata
            print("Step 1: Metadata")
            prompt1_template = PromptService.get_prompt(self.brand_id, "step1_metadata.txt")
            # Fill template (simplified)
            prompt1 = prompt1_template.replace("{product_title}", product_data.get('title', '')) \
                                      .replace("{product_id}", product_id)
            # Just append the whole product data as context if prompt expects it
            prompt1 += f"\n\nContext Product Data: {json.dumps(product_data, default=str)}"
            
            step1_content = [prompt1] + images
            step1_res_text = await self.generate_content_with_retry(step1_content)
            step1_json = self.extract_json_from_response(step1_res_text)
            result['pipeline_outputs']['step1_metadata'] = step1_json
            
            # Step 2: Attributes (Only for Ecommerce)
            if 'ecommerce' in modes:
                print("Step 2: Attributes")
                prompt2_template = PromptService.get_prompt(self.brand_id, "step2_attributes.txt")
                prompt2 = prompt2_template + f"\n\nMetadata so far: {json.dumps(step1_json)}"
                
                step2_content = [prompt2] + images
                step2_res_text = await self.generate_content_with_retry(step2_content)
                step2_json = self.extract_json_from_response(step2_res_text)
                result['pipeline_outputs']['step2_attributes'] = step2_json
                
                # Step 3: E-commerce Prompts
                print("Step 3: E-commerce Prompts")
                prompt3_template = PromptService.get_prompt(self.brand_id, "step3_ecommerce_prompts.txt")
                prompt3 = prompt3_template.replace("{attributes_json}", json.dumps(step2_json)) \
                                          .replace("{metadata_json}", json.dumps(step1_json))
                
                step3_content = [prompt3] + images
                step3_res_text = await self.generate_content_with_retry(step3_content)
                step3_json = self.extract_json_from_response(step3_res_text)
                result['pipeline_outputs']['step3_ecommerce_prompts'] = step3_json
                
                # Step 4: E-commerce Image Generation
                print("Step 4: E-commerce Images")
                prompt4_template = PromptService.get_prompt(self.brand_id, "ecommerce_image_generation.txt")
                
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
                    "ecommerce_images": generated_images_results
                }

            # Step 5: Lookbook Prompts
            if 'lookbook' in modes:
                print("Step 5: Lookbook Prompts")
                prompt5_template = PromptService.get_prompt(self.brand_id, "step5_lookbook_prompts.txt")
                prompt5 = prompt5_template.replace("{metadata_json}", json.dumps(step1_json)) \
                                          .replace("{product_title}", product_data.get('title', ''))
                
                step5_content = [prompt5] + images
                step5_res_text = await self.generate_content_with_retry(step5_content)
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
        try:
            supabase.table("products").update({
                "generated_content": result,
                "processed": True if result['status'] == 'completed' else False,
                "processed_at": datetime.now().isoformat()
            }).eq("brand_id", self.brand_id).eq("product_id", product_id).execute()
        except Exception as e:
            print(f"Error updating DB: {e}")
        
        # 2. Save to Storage
        try:
            json_content = json.dumps(result, indent=2)
            supabase.storage.from_("output").upload(f"{self.brand_id}/{product_id}/product_data.json", json_content.encode(), file_options={"upsert": "true"})
        except Exception as e:
            print(f"Error updating Storage: {e}")
