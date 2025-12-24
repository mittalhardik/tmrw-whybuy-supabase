-- Migration: Add Shopify Sync Columns to Products Table
-- Created: 2025-12-24
-- Description: Adds Shopify integration fields to enable manual product sync

-- Add Shopify-specific columns
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS shopify_id bigint,
ADD COLUMN IF NOT EXISTS shopify_handle text,
ADD COLUMN IF NOT EXISTS shopify_status text,
ADD COLUMN IF NOT EXISTS shopify_raw_data jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS last_synced_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS metafield_synced_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS push_status text,
ADD COLUMN IF NOT EXISTS pushed_at timestamp with time zone;

-- Add unique constraint on shopify_id (prevents duplicate products from same Shopify store)
-- Only add if it doesn't already exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'products_shopify_id_unique'
    ) THEN
        ALTER TABLE products 
        ADD CONSTRAINT products_shopify_id_unique UNIQUE (brand_id, shopify_id);
    END IF;
END $$;

-- Add index for lookups by handle
CREATE INDEX IF NOT EXISTS idx_products_shopify_handle ON products(brand_id, shopify_handle);

-- Add index for shopify_id lookups
CREATE INDEX IF NOT EXISTS idx_products_shopify_id ON products(shopify_id);

-- Add index for push_status filtering
CREATE INDEX IF NOT EXISTS idx_products_push_status ON products(push_status);

-- Comment the columns for documentation
COMMENT ON COLUMN products.shopify_id IS 'Numeric Shopify product ID from the Shopify API';
COMMENT ON COLUMN products.shopify_handle IS 'URL-friendly product handle from Shopify';
COMMENT ON COLUMN products.shopify_status IS 'Product status in Shopify: active, draft, or archived';
COMMENT ON COLUMN products.shopify_raw_data IS 'Complete product object from Shopify (excludes variants/inventory)';
COMMENT ON COLUMN products.last_synced_at IS 'Timestamp of last successful sync from Shopify';
COMMENT ON COLUMN products.metafield_synced_at IS 'Timestamp when custom.ai_generated_content metafield was last synced to Shopify';
COMMENT ON COLUMN products.push_status IS 'Status of content push to Shopify: pushed, pending, failed';
COMMENT ON COLUMN products.pushed_at IS 'Timestamp when content was last pushed to Shopify';
