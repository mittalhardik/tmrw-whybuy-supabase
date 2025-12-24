-- Migration: Add push_status column and migrate existing data
-- Created: 2025-12-24
-- Description: Adds push_status text column and migrates from pushed_to_shopify boolean

-- Add push_status column
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS push_status text;

-- Migrate existing pushed_to_shopify values to push_status
UPDATE products 
SET push_status = CASE 
    WHEN pushed_to_shopify = true THEN 'pushed'
    ELSE NULL
END
WHERE push_status IS NULL;

-- Add index for push_status filtering
CREATE INDEX IF NOT EXISTS idx_products_push_status ON products(push_status);

-- Add comment
COMMENT ON COLUMN products.push_status IS 'Status of content push to Shopify: pushed, pending, failed';

-- Optional: You can drop pushed_to_shopify column after verifying migration
-- ALTER TABLE products DROP COLUMN IF EXISTS pushed_to_shopify;
