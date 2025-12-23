import pandas as pd
import io
import json
from datetime import datetime
from fastapi import UploadFile
from ..supabase_client import supabase

class UploadService:
    @staticmethod
    async def process_upload(file: UploadFile, brand_id: str):
        # 1. Read file content
        content = await file.read()
        
        # 2. Upload raw file to Supabase Storage 'uploads' bucket
        filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        supabase.storage.from_("uploads").upload(f"{brand_id}/{filename}", content)
        
        # 3. Parse Excel
        df = pd.read_excel(io.BytesIO(content))
        
        # 4. Extract Products
        products = []
        # Group by Handle (Shopify format)
        # Note: minimal implementation, needs robust logic from original codebase
        if 'Handle' in df.columns:
            grouped = df.groupby('Handle')
        else:
            # Fallback if specific format differs
            grouped = df.groupby(df.columns[0])

        new_products_count = 0
        
        for handle, group in grouped:
            row = group.iloc[0]
            
            # Map fields
            product_data = {
                "brand_id": brand_id,
                "product_id": str(handle),
                "title": str(row.get('Title', '')),
                "vendor": str(row.get('Vendor', '')),
                "product_type": str(row.get('Type', '')),
                "tags": str(row.get('Tags', '')),
                "image_urls": [str(url) for url in group['Image Src'].dropna().tolist()] if 'Image Src' in group else [],
                "full_data": json.loads(group.to_json(orient='records')), # Store raw rows
                "uploaded_at": datetime.now().isoformat(),
                "processed": False
            }
            
            # 5. Insert/Update in DB (Upsert)
            # Using upsert to handle re-uploads
            supabase.table("products").upsert(product_data, on_conflict="brand_id, product_id").execute()
            new_products_count += 1
            
            products.append(product_data)
            
        # 6. Parity: Update products.json in Storage 'data' bucket
        # Fetch ALL products for brand to rebuild the file
        all_products_response = supabase.table("products").select("product_id", "full_data").eq("brand_id", brand_id).execute()
        
        # Reconstruct the dictionary format expected by legacy code: {product_id: product_data}
        legacy_db = {}
        for p in all_products_response.data:
            legacy_db[p['product_id']] = p['full_data'][0] if isinstance(p['full_data'], list) and p['full_data'] else p['full_data']
            # Enrich with backend fields if needed
            
        json_content = json.dumps(legacy_db, indent=2)
        
        # Upsert file to storage
        try:
            supabase.storage.from_("data").update(f"{brand_id}/products.json", json_content.encode())
        except:
             # If update fails (file doesn't exist), try upload
            supabase.storage.from_("data").upload(f"{brand_id}/products.json", json_content.encode())
            
        return {
            "success": True,
            "filename": filename,
            "products_count": new_products_count
        }
