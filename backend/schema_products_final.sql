-- Final Products Table Schema
-- Updated: 2025-12-24
-- Description: Comprehensive schema for products with Shopify sync support

DROP TABLE IF EXISTS public.products CASCADE;

CREATE TABLE public.products (
  -- Primary identifiers
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  brand_id uuid NOT NULL,
  product_id text NOT NULL,
  
  -- Basic product information
  title text NULL,
  vendor text NULL,
  product_type text NULL,
  tags text NULL,
  image_urls jsonb NULL DEFAULT '[]'::jsonb,
  
  -- Analytics
  atc_delta double precision NULL,
  
  -- Data storage
  full_data jsonb NULL DEFAULT '{}'::jsonb,
  generated_content jsonb NULL DEFAULT '{}'::jsonb,
  
  -- Processing status
  uploaded_at timestamp with time zone NULL DEFAULT timezone('utc'::text, now()),
  processed boolean NULL DEFAULT false,
  processed_at timestamp with time zone NULL,
  flagged boolean NULL DEFAULT false,
  
  -- Shopify sync fields
  shopify_id bigint NULL,
  shopify_handle text NULL,
  shopify_status text NULL,
  shopify_raw_data jsonb NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamp with time zone NULL,
  metafield_synced_at timestamp with time zone NULL,
  
  -- Push status (replaces pushed_to_shopify boolean)
  push_status text NULL,  -- 'pushed', 'pending', 'failed'
  pushed_at timestamp with time zone NULL,
  
  -- Constraints
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_brand_id_product_id_key UNIQUE (brand_id, product_id),
  CONSTRAINT products_shopify_id_unique UNIQUE (brand_id, shopify_id),
  CONSTRAINT products_brand_id_fkey FOREIGN KEY (brand_id) 
    REFERENCES brands(id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Indexes for performance
CREATE INDEX idx_products_brand_id ON public.products USING btree (brand_id);
CREATE INDEX idx_products_shopify_handle ON public.products USING btree (brand_id, shopify_handle);
CREATE INDEX idx_products_shopify_id ON public.products USING btree (shopify_id);
CREATE INDEX idx_products_push_status ON public.products USING btree (push_status);
CREATE INDEX idx_products_processed ON public.products USING btree (processed);

-- Column comments for documentation
COMMENT ON TABLE public.products IS 'Product catalog with Shopify synchronization support';
COMMENT ON COLUMN public.products.id IS 'Unique product UUID';
COMMENT ON COLUMN public.products.brand_id IS 'Reference to brands table';
COMMENT ON COLUMN public.products.product_id IS 'External product identifier (can be Shopify ID as string)';
COMMENT ON COLUMN public.products.shopify_id IS 'Numeric Shopify product ID from the Shopify API';
COMMENT ON COLUMN public.products.shopify_handle IS 'URL-friendly product handle from Shopify';
COMMENT ON COLUMN public.products.shopify_status IS 'Product status in Shopify: active, draft, or archived';
COMMENT ON COLUMN public.products.shopify_raw_data IS 'Complete product object from Shopify (excludes variants/inventory)';
COMMENT ON COLUMN public.products.last_synced_at IS 'Timestamp of last successful product data sync from Shopify';
COMMENT ON COLUMN public.products.metafield_synced_at IS 'Timestamp when custom.ai_generated_content metafield was last synced';
COMMENT ON COLUMN public.products.push_status IS 'Status of content push to Shopify: pushed, pending, failed';
COMMENT ON COLUMN public.products.pushed_at IS 'Timestamp when content was last pushed to Shopify';
COMMENT ON COLUMN public.products.full_data IS 'Legacy field for raw product data';
COMMENT ON COLUMN public.products.generated_content IS 'AI-generated content (synced with Shopify metafield)';
