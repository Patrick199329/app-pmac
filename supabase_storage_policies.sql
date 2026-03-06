-- 1. Policies for report-templates (DOCX)
-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads for templates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'report-templates');

-- Allow authenticated users to update their own templates
CREATE POLICY "Allow authenticated updates for templates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'report-templates');

-- Allow public read (since bucket is public, this might already be active, but safe to add)
CREATE POLICY "Allow public read for templates"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'report-templates');


-- 2. Policies for report-files (PDF)
CREATE POLICY "Allow authenticated uploads for report-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'report-files');

CREATE POLICY "Allow authenticated updates for report-files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'report-files');

CREATE POLICY "Allow public read for report-files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'report-files');
