-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Brands Table
create table brands (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text not null unique, -- e.g. 'TIGC'
  shopify_config jsonb default '{}'::jsonb,
  settings jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Products Table
create table products (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid references brands(id) on delete cascade not null,
  product_id text not null, -- The Shopify Product ID or Handle
  title text,
  vendor text,
  product_type text,
  tags text,
  image_urls jsonb default '[]'::jsonb,
  
  -- Analysis Data
  atc_delta float,
  
  -- Pipeline Data
  full_data jsonb default '{}'::jsonb, -- Raw data from products.json
  generated_content jsonb default '{}'::jsonb, -- Result from product_data.json
  
  -- Status
  uploaded_at timestamp with time zone default timezone('utc'::text, now()),
  processed boolean default false,
  processed_at timestamp with time zone,
  flagged boolean default false,
  pushed_to_shopify boolean default false,
  pushed_at timestamp with time zone,
  
  unique(brand_id, product_id)
);

-- Pipeline Jobs Table
create table pipeline_jobs (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid references brands(id) on delete cascade not null,
  status text not null, -- 'running', 'completed', 'failed'
  progress int default 0,
  total_products int default 0,
  error text,
  logs jsonb default '[]'::jsonb,
  started_at timestamp with time zone default timezone('utc'::text, now()),
  completed_at timestamp with time zone
);

-- Prompts Table
create table prompts (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid references brands(id) on delete cascade not null,
  name text not null, -- e.g. 'step1_metadata'
  content text not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  
  unique(brand_id, name)
);

-- Storage Buckets (Implicitly handled by Supabase Storage, but good to note)
-- buckets: 'uploads', 'data', 'output', 'prompts', 'images'

-- RLS Policies (Basic Template - Open for now, lock down later)
alter table brands enable row level security;
create policy "Allow all access for now" on brands for all using (true);

alter table products enable row level security;
create policy "Allow all access for now" on products for all using (true);

alter table pipeline_jobs enable row level security;
create policy "Allow all access for now" on pipeline_jobs for all using (true);

alter table prompts enable row level security;
create policy "Allow all access for now" on prompts for all using (true);
