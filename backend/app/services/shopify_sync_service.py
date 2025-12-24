import httpx
import json
from typing import Dict, Any, Optional
from datetime import datetime


class ShopifySyncService:
    """Service for syncing products and metafields with Shopify."""
    
    @staticmethod
    async def _make_request(
        method: str,
        url: str,
        headers: dict,
        json_data: Optional[dict] = None
    ) -> dict:
        """Helper for Shopify API requests with error handling."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                if method == "GET":
                    response = await client.get(url, headers=headers)
                elif method == "POST":
                    response = await client.post(url, headers=headers, json=json_data)
                elif method == "PUT":
                    response = await client.put(url, headers=headers, json=json_data)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")
                
                # Handle different error status codes
                if response.status_code == 404:
                    raise Exception("Product or metafield not found in Shopify")
                elif response.status_code == 401:
                    raise Exception("Invalid Shopify credentials. Please check your access token.")
                elif response.status_code == 429:
                    raise Exception("Shopify rate limit exceeded. Please try again in a few moments.")
                elif response.status_code >= 400:
                    raise Exception(f"Shopify API error ({response.status_code}): {response.text}")
                
                return response.json()
            except httpx.RequestError as e:
                raise Exception(f"Network error connecting to Shopify: {str(e)}")
    
    @staticmethod
    async def fetch_product_by_id(shopify_id: int, brand_config: dict) -> dict:
        """
        Fetch a single product from Shopify by its numeric ID, including metafields.
        
        Args:
            shopify_id: Numeric Shopify product ID
            brand_config: Brand's Shopify configuration (domain, token, version)
            
        Returns:
            Product object from Shopify with metafields included
        """
        domain = brand_config.get("shopify_domain")
        token = brand_config.get("shopify_access_token")
        version = brand_config.get("shopify_api_version", "2024-01")
        
        if not domain or not token:
            raise Exception("Missing Shopify credentials in brand configuration")
        
        headers = {"X-Shopify-Access-Token": token}
        
        # Fetch product data
        product_url = f"https://{domain}/admin/api/{version}/products/{shopify_id}.json"
        product_data = await ShopifySyncService._make_request("GET", product_url, headers)
        product = product_data.get("product", {})
        
        # Fetch metafields separately
        metafields_url = f"https://{domain}/admin/api/{version}/products/{shopify_id}/metafields.json"
        metafields_data = await ShopifySyncService._make_request("GET", metafields_url, headers)
        metafields = metafields_data.get("metafields", [])
        
        # Add metafields to product object
        product["metafields"] = metafields
        
        return product
    
    @staticmethod
    async def fetch_product_by_handle(handle: str, brand_config: dict) -> dict:
        """
        Fetch a single product from Shopify by its handle, including metafields.
        
        Args:
            handle: URL-friendly product handle
            brand_config: Brand's Shopify configuration
            
        Returns:
            Product object from Shopify with metafields included
        """
        domain = brand_config.get("shopify_domain")
        token = brand_config.get("shopify_access_token")
        version = brand_config.get("shopify_api_version", "2024-01")
        
        if not domain or not token:
            raise Exception("Missing Shopify credentials in brand configuration")
        
        headers = {"X-Shopify-Access-Token": token}
        
        # Fetch product by handle
        product_url = f"https://{domain}/admin/api/{version}/products.json?handle={handle}"
        product_data = await ShopifySyncService._make_request("GET", product_url, headers)
        products = product_data.get("products", [])
        
        if not products:
            raise Exception(f"Product with handle '{handle}' not found in Shopify")
        
        product = products[0]
        shopify_id = product.get("id")
        
        # Fetch metafields for this product
        metafields_url = f"https://{domain}/admin/api/{version}/products/{shopify_id}/metafields.json"
        metafields_data = await ShopifySyncService._make_request("GET", metafields_url, headers)
        metafields = metafields_data.get("metafields", [])
        
        # Add metafields to product object
        product["metafields"] = metafields
        
        return product
    
    @staticmethod
    def transform_shopify_product(raw_product: dict) -> dict:
        """
        Transform Shopify product format to Supabase schema.
        Extracts only relevant fields and handles ai_generated_content metafield.
        
        Args:
            raw_product: Raw product object from Shopify API (with metafields)
            
        Returns:
            Dict formatted for Supabase products table
        """
        # Extract image URLs (product-level images only)
        image_urls = []
        if "images" in raw_product:
            image_urls = [img.get("src") for img in raw_product["images"] if img.get("src")]
        
        # Extract metafields
        metafields = raw_product.get("metafields", [])
        
        # Find ai_generated_content metafield
        generated_content = None
        custom_metafields = {}
        
        for mf in metafields:
            namespace = mf.get("namespace")
            key = mf.get("key")
            value = mf.get("value")
            
            # Extract ai_generated_content
            if namespace == "custom" and key == "ai_generated_content":
                try:
                    # Parse JSON string to dict
                    generated_content = json.loads(value) if isinstance(value, str) else value
                except (json.JSONDecodeError, TypeError):
                    generated_content = value
            
            # Store other useful custom metafields
            elif namespace == "custom":
                custom_metafields[key] = value
        
        # Create clean shopify_raw_data with only relevant fields
        shopify_raw_data = {
            "id": raw_product.get("id"),
            "title": raw_product.get("title"),
            "handle": raw_product.get("handle"),
            "body_html": raw_product.get("body_html"),
            "vendor": raw_product.get("vendor"),
            "product_type": raw_product.get("product_type"),
            "status": raw_product.get("status"),
            "tags": raw_product.get("tags"),
            "options": raw_product.get("options", []),
            "images": raw_product.get("images", []),
            "created_at": raw_product.get("created_at"),
            "updated_at": raw_product.get("updated_at"),
            "published_at": raw_product.get("published_at"),
            "custom_metafields": custom_metafields  # Store useful custom metafields
        }
        
        transformed_data = {
            "shopify_id": raw_product.get("id"),
            "shopify_handle": raw_product.get("handle"),
            "shopify_status": raw_product.get("status"),
            "title": raw_product.get("title"),
            "vendor": raw_product.get("vendor"),
            "product_type": raw_product.get("product_type"),
            "tags": raw_product.get("tags", ""),
            "image_urls": image_urls,
            "shopify_raw_data": shopify_raw_data,
            "last_synced_at": datetime.utcnow().isoformat(),
        }
        
        # If ai_generated_content exists, populate generated_content and set processed flag
        if generated_content:
            transformed_data["generated_content"] = generated_content
            transformed_data["processed"] = True
            transformed_data["push_status"] = "pushed"  # Already in Shopify
            transformed_data["pushed_at"] = datetime.utcnow().isoformat()
            
            # Also update metafield_synced_at since we're syncing from Shopify
            transformed_data["metafield_synced_at"] = datetime.utcnow().isoformat()
        else:
            # No ai_generated_content, reset push status
            transformed_data["push_status"] = None
            transformed_data["pushed_at"] = None
        
        return transformed_data
    
    @staticmethod
    async def save_product_to_db(product_data: dict, brand_id: str, supabase) -> dict:
        """
        Save or update product in Supabase database.
        
        Args:
            product_data: Transformed product data
            brand_id: UUID of the brand
            supabase: Supabase client instance
            
        Returns:
            Saved product record
        """
        # Add brand_id to product data
        product_data["brand_id"] = brand_id
        
        # Use shopify_id as product_id if product_id doesn't exist
        if "product_id" not in product_data:
            product_data["product_id"] = str(product_data["shopify_id"])
        
        # Upsert based on brand_id + shopify_id
        response = supabase.table("products").upsert(
            product_data,
            on_conflict="brand_id,shopify_id"
        ).execute()
        
        return response.data[0] if response.data else None
    
    @staticmethod
    async def read_metafield(shopify_id: int, brand_config: dict) -> Optional[dict]:
        """
        Read the custom.ai_generated_content metafield from Shopify.
        
        Args:
            shopify_id: Numeric Shopify product ID
            brand_config: Brand's Shopify configuration
            
        Returns:
            Parsed metafield value as dict, or None if not found
        """
        domain = brand_config.get("shopify_domain")
        token = brand_config.get("shopify_access_token")
        version = brand_config.get("shopify_api_version", "2024-01")
        
        if not domain or not token:
            raise Exception("Missing Shopify credentials in brand configuration")
        
        url = f"https://{domain}/admin/api/{version}/products/{shopify_id}/metafields.json"
        headers = {"X-Shopify-Access-Token": token}
        
        try:
            data = await ShopifySyncService._make_request("GET", url, headers)
            metafields = data.get("metafields", [])
            
            # Find the ai_generated_content metafield
            for metafield in metafields:
                if (metafield.get("namespace") == "custom" and 
                    metafield.get("key") == "ai_generated_content"):
                    value = metafield.get("value")
                    if value:
                        # Parse JSON string to dict
                        return json.loads(value) if isinstance(value, str) else value
            
            return None  # Metafield not found or empty
        except Exception as e:
            # If metafield doesn't exist, return None instead of raising error
            if "not found" in str(e).lower():
                return None
            raise
    
    @staticmethod
    async def write_metafield(shopify_id: int, content: dict, brand_config: dict) -> bool:
        """
        Write content to the custom.ai_generated_content metafield in Shopify.
        
        Args:
            shopify_id: Numeric Shopify product ID
            content: Dict to store in metafield
            brand_config: Brand's Shopify configuration
            
        Returns:
            True if successful
        """
        domain = brand_config.get("shopify_domain")
        token = brand_config.get("shopify_access_token")
        version = brand_config.get("shopify_api_version", "2024-01")
        
        if not domain or not token:
            raise Exception("Missing Shopify credentials in brand configuration")
        
        url = f"https://{domain}/admin/api/{version}/products/{shopify_id}/metafields.json"
        headers = {"X-Shopify-Access-Token": token}
        
        payload = {
            "metafield": {
                "namespace": "custom",
                "key": "ai_generated_content",
                "value": json.dumps(content),
                "type": "json"
            }
        }
        
        await ShopifySyncService._make_request("POST", url, headers, payload)
        return True
    
    @staticmethod
    async def sync_product(
        identifier: str,
        brand_id: str,
        brand_config: dict,
        supabase,
        by_handle: bool = False
    ) -> dict:
        """
        Main orchestration method to sync a product from Shopify to Supabase.
        
        Args:
            identifier: Shopify Product ID (numeric) or Handle (string)
            brand_id: UUID of the brand
            brand_config: Brand's Shopify configuration
            supabase: Supabase client instance
            by_handle: If True, treat identifier as handle; otherwise as ID
            
        Returns:
            Synced product details
        """
        # Fetch product from Shopify
        if by_handle:
            raw_product = await ShopifySyncService.fetch_product_by_handle(identifier, brand_config)
        else:
            shopify_id = int(identifier)
            raw_product = await ShopifySyncService.fetch_product_by_id(shopify_id, brand_config)
        
        # Check if this is a refresh (product already exists)
        shopify_id = raw_product.get("id")
        existing_product = supabase.table("products").select("id, generated_content, processed").eq(
            "brand_id", brand_id
        ).eq("shopify_id", shopify_id).execute()
        
        is_refresh = len(existing_product.data) > 0
        
        # Transform to Supabase format
        product_data = ShopifySyncService.transform_shopify_product(raw_product)
        
        # If this is a refresh and the product had generated content, clear it
        # This signals to the user that they need to reprocess after refreshing
        if is_refresh and existing_product.data[0].get("generated_content"):
            print(f"Refresh detected: Clearing generated_content for product {shopify_id}")
            product_data["generated_content"] = None
            product_data["processed"] = False
            product_data["push_status"] = None
            product_data["pushed_at"] = None
            # Note: We don't delete storage files here - that happens during reprocess
        
        # Save to database
        saved_product = await ShopifySyncService.save_product_to_db(product_data, brand_id, supabase)
        
        return {
            "success": True,
            "product": saved_product,
            "is_refresh": is_refresh
        }
