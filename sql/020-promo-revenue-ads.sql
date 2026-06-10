-- =============================================
-- 020-promo-revenue-ads.sql
-- Phase 3 du module Budget & Planning : sync auto des perfs promo.
--
-- Ajoute revenue_ads (CA attribue aux canaux payants) en complement de
-- revenue_total (CA tous canaux). Le ROAS de la card se calcule sur
-- revenue_ads / (ads_spend_google + ads_spend_meta) — coherent avec le
-- ROAS Site du dashboard. revenue_total montre l'effet halo de la promo.
--
-- top_products existe deja (015) : array JSONB de {name, revenue, quantity}.
--
-- Run AFTER 019-rls-fix-recursion.sql in Supabase SQL Editor. Idempotent.
-- =============================================

ALTER TABLE client_promos
    ADD COLUMN IF NOT EXISTS revenue_ads NUMERIC(12, 2) DEFAULT 0 CHECK (revenue_ads >= 0);

UPDATE client_promos
    SET revenue_ads = COALESCE(revenue_ads, 0)
    WHERE revenue_ads IS NULL;

-- Verification :
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'client_promos' AND column_name IN ('revenue_ads','revenue_total','top_products');
--   → 3 lignes
