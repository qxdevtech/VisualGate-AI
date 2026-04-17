-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create users table
create table public.users (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create face_embeddings table
create table public.face_embeddings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  embedding vector(128) not null, -- face_recognition uses 128D embeddings
  image_url text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create access_logs table
create table public.access_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade,
  success boolean not null,
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
-- Since backend uses service_role key, we can just enable RLS and leave it restricted for anon/authenticated
alter table public.users enable row level security;
alter table public.face_embeddings enable row level security;
alter table public.access_logs enable row level security;

-- Create storage bucket (if not created via UI)
insert into storage.buckets (id, name, public) values ('faces', 'faces', true);
