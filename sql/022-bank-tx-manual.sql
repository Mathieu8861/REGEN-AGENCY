-- ============================================
-- 022-bank-tx-manual.sql
-- Flag "correction manuelle" sur les transactions bancaires :
-- une ligne corrigee a la main n'est plus ecrasee par "Recategoriser".
-- Idempotent. A lancer dans le SQL Editor de Supabase.
-- ============================================

ALTER TABLE bank_transactions
    ADD COLUMN IF NOT EXISTS manual_override BOOLEAN NOT NULL DEFAULT false;
