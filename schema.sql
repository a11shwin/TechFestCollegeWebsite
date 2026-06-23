-- Carmel College of Engineering and Technology Tech Fest Event Registration Schema
-- Execute these SQL queries in your Supabase SQL Editor.

-- 1. Create the registrations table
CREATE TABLE IF NOT EXISTS public.registrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    department TEXT NOT NULL,
    year INTEGER NOT NULL,
    college_name TEXT NOT NULL,
    event TEXT NOT NULL,
    gender TEXT NOT NULL,
    payment_screenshot_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Composite unique constraints: prevent a user from registering for the SAME event multiple times,
    -- but allow registering for multiple different events (e.g., Hackathon AND Web Dev).
    CONSTRAINT unique_email_event UNIQUE (email, event),
    CONSTRAINT unique_phone_event UNIQUE (phone, event)
);

-- 2. Configure Row Level Security (RLS)
-- Enable RLS on registrations
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- Create Policy: Allow public anonymous inserts (for registrations)
CREATE POLICY "Allow public anonymous registrations" 
ON public.registrations 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Create Policy: Allow admin (service_role) to select/delete registrations
CREATE POLICY "Allow service_role full control" 
ON public.registrations 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- 3. Storage Setup (Payment Screenshots Bucket)
-- Go to Supabase Dashboard -> Storage -> Create New Bucket
-- Bucket ID: "screenshots"
-- Public: YES (so screenshots can be viewed/downloaded by admin)
-- Alternatively, execute the SQL below if you have database functions setup:
-- (Note: It is easier to create the bucket "screenshots" manually via the Supabase UI and set it to public)

-- SQL for configuring storage policies for the "screenshots" bucket
-- (Only execute this if the bucket is created)
-- Policy: Allow anyone to upload to "screenshots"
CREATE POLICY "Allow public upload to screenshots"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'screenshots');

-- Policy: Allow public to view screenshots
CREATE POLICY "Allow public select from screenshots"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'screenshots');
