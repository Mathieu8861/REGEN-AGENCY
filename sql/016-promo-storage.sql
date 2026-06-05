-- =============================================
-- 016-promo-storage.sql
-- Cree le bucket Supabase Storage pour les visuels de promotion
-- + policies RLS pour controler qui peut upload/delete/voir.
--
-- Strategie :
--   - bucket public (anyone with the URL peut voir l'image directement)
--   - upload/delete : admin/staff seulement
--   - max 5 Mo/fichier, formats images uniquement
--   - path : promo-visuals/{client_id}/{timestamp}-{idx}.{ext}
--
-- Run AFTER 015-promo-fields.sql in Supabase SQL Editor
-- Idempotent.
-- =============================================

-- 1. Cree le bucket (public, max 5 Mo, formats images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'promo-visuals',
    'promo-visuals',
    true,
    5242880, -- 5 MB
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
    SET public = EXCLUDED.public,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Policy INSERT : admin/staff seulement
DROP POLICY IF EXISTS "Admin/staff can upload promo visuals" ON storage.objects;
CREATE POLICY "Admin/staff can upload promo visuals"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'promo-visuals'
        AND get_user_role() IN ('admin', 'staff')
    );

-- 3. Policy SELECT : anyone (puisque bucket public)
DROP POLICY IF EXISTS "Public read promo visuals" ON storage.objects;
CREATE POLICY "Public read promo visuals"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'promo-visuals');

-- 4. Policy DELETE : admin/staff seulement
DROP POLICY IF EXISTS "Admin/staff can delete promo visuals" ON storage.objects;
CREATE POLICY "Admin/staff can delete promo visuals"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'promo-visuals'
        AND get_user_role() IN ('admin', 'staff')
    );

-- 5. Verification :
--   SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'promo-visuals';
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%promo%';
