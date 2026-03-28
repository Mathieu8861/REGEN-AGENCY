-- ============================================
-- 011 - Next Action fields on prospects
-- ============================================
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS next_action_date DATE;
