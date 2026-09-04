-- Add avatar_url to profiles if it doesn't exist
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Update provider_portfolio_items to support videos
ALTER TABLE provider_portfolio_items
ADD COLUMN IF NOT EXISTS media_type VARCHAR(10) DEFAULT 'image', -- 'image' or 'video'
ADD COLUMN IF NOT EXISTS duration_seconds INT;

-- Add description column for portfolio items (like Instagram captions)
ALTER TABLE provider_portfolio_items
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add created_at for ordering
ALTER TABLE provider_portfolio_items
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
