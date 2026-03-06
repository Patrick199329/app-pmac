-- 1. Update report_assets table
ALTER TABLE report_assets ADD COLUMN IF NOT EXISTS asset_type TEXT DEFAULT 'PDF';
ALTER TABLE report_assets ADD COLUMN IF NOT EXISTS template_hash TEXT;
ALTER TABLE report_assets ADD COLUMN IF NOT EXISTS template_version INTEGER DEFAULT 1;
ALTER TABLE report_assets ADD COLUMN IF NOT EXISTS file_path TEXT;

-- 2. Create report_jobs table for concurrency control
CREATE TABLE IF NOT EXISTS report_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    asset_id UUID NOT NULL REFERENCES report_assets(id),
    status TEXT NOT NULL DEFAULT 'processing',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, asset_id)
);

-- 3. Create report_generation_logs for observability
CREATE TABLE IF NOT EXISTS report_generation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    asset_id UUID REFERENCES report_assets(id),
    duration_ms INTEGER,
    status TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Enable RLS on new tables (Optional but recommended)
ALTER TABLE report_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_generation_logs ENABLE ROW LEVEL SECURITY;

-- 5. Helper function to check/update jobs (can be used in Edge Function)
-- This is a placeholder for the logic we'll use.
