-- =============================================
-- 017-promo-videos.sql
-- Ajoute le support des liens video sur les promotions.
-- Champ separe de landing_urls car semantiquement different :
-- les videos peuvent etre du YouTube, Vimeo, Drive, Loom, etc.
--
-- Run AFTER 016-promo-storage.sql in Supabase SQL Editor
-- Idempotent.
-- =============================================

ALTER TABLE client_promos
    ADD COLUMN IF NOT EXISTS video_urls JSONB DEFAULT '[]'::JSONB;

UPDATE client_promos
    SET video_urls = COALESCE(video_urls, '[]'::JSONB)
    WHERE video_urls IS NULL;

-- Verification :
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'client_promos' AND column_name = 'video_urls';
