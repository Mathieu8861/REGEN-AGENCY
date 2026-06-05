-- =============================================
-- 015-promo-fields.sql
-- Enrichit la table client_promos avec les champs demandes par Jaemeson :
--   - landing_urls (jsonb array) : 1 a N liens vers les landing pages cibles
--   - drive_url (text) : lien Google Drive vers les visuels source
--   - visuals (jsonb array) : URLs vers visuels uploades (phase 2 : Supabase Storage)
--   - remise_text (text) : description longue de la remise (separe de offer_text qui est court)
--   - ads_spend_google + ads_spend_meta : depenses sur la periode (saisie manuelle ou sync auto)
--   - revenue_total : CA genere sur la periode
--   - top_products (jsonb) : top 3 produits performants pour le ROI/CA
--
-- Run AFTER 014-client-budgets.sql in Supabase SQL Editor
-- Idempotent : ADD COLUMN IF NOT EXISTS, peut etre rerun sans casse.
-- =============================================

ALTER TABLE client_promos
    ADD COLUMN IF NOT EXISTS landing_urls JSONB DEFAULT '[]'::JSONB,
    ADD COLUMN IF NOT EXISTS drive_url TEXT,
    ADD COLUMN IF NOT EXISTS visuals JSONB DEFAULT '[]'::JSONB,
    ADD COLUMN IF NOT EXISTS remise_text TEXT,
    ADD COLUMN IF NOT EXISTS ads_spend_google NUMERIC(12, 2) DEFAULT 0 CHECK (ads_spend_google >= 0),
    ADD COLUMN IF NOT EXISTS ads_spend_meta NUMERIC(12, 2) DEFAULT 0 CHECK (ads_spend_meta >= 0),
    ADD COLUMN IF NOT EXISTS revenue_total NUMERIC(12, 2) DEFAULT 0 CHECK (revenue_total >= 0),
    ADD COLUMN IF NOT EXISTS top_products JSONB DEFAULT '[]'::JSONB;

-- Si la migration tourne sur une DB qui a deja des promos creees avec l'ancien modele,
-- on s'assure que les colonnes nouvelles aient des defaults coherents pour les rows existantes.
UPDATE client_promos
    SET landing_urls = COALESCE(landing_urls, '[]'::JSONB),
        visuals = COALESCE(visuals, '[]'::JSONB),
        top_products = COALESCE(top_products, '[]'::JSONB),
        ads_spend_google = COALESCE(ads_spend_google, 0),
        ads_spend_meta = COALESCE(ads_spend_meta, 0),
        revenue_total = COALESCE(revenue_total, 0)
    WHERE landing_urls IS NULL
       OR visuals IS NULL
       OR top_products IS NULL
       OR ads_spend_google IS NULL
       OR ads_spend_meta IS NULL
       OR revenue_total IS NULL;

-- Verification :
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'client_promos'
--   ORDER BY ordinal_position;
