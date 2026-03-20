-- ============================================
-- REGEN AGENCY - Add group_name to clients
-- Run in Supabase SQL Editor
-- ============================================

-- Add group_name column for multi-site clients (e.g., Emile & Co manages OXO, Marcato, Bamix)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS group_name TEXT;

-- Set groups for known multi-site clients
UPDATE clients SET group_name = 'Emile & Co' WHERE name IN ('OXO', 'Marcato', 'Bamix', 'Nordic Ware');

-- NOTE: Vitamix remains ungrouped (group_name = NULL) as it's a standalone client
