-- =============================================
-- 014-client-budgets.sql
-- Module "Budget & Planning Promos" pour les clients
--
-- 2 tables :
--   - client_budgets : budgets mensuels par client, par plateforme (google/meta/tiktok)
--   - client_promos  : calendrier des promos avec wordings + perf historique
--
-- Strategie de groupement (Q1=B) :
--   - 1 ligne client = 1 marque (ex: OXO, Bamix, Emile Henry sont 6 lignes distinctes
--     dans `clients`, toutes avec group_name='Emile & Co'). Le UI cote admin/client
--     aggregera par group_name pour montrer le tableau consolide.
--
-- Permissions (Q2=A) :
--   - admin/staff : ALL (read + write)
--   - client (role='client') : SELECT seulement via user_can_access_client()
--
-- Run AFTER 013-rls-hardening.sql in Supabase SQL Editor
-- Idempotent : DROP POLICY IF EXISTS partout, CREATE TABLE IF NOT EXISTS, peut etre rerun.
-- =============================================

-- ============================================
-- 1. CLIENT_BUDGETS — budget mensuel par client/plateforme
-- ============================================
CREATE TABLE IF NOT EXISTS client_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    year INT NOT NULL CHECK (year BETWEEN 2020 AND 2100),
    month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    platform TEXT NOT NULL CHECK (platform IN ('google_ads', 'meta_ads', 'tiktok_ads')),
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    -- true = depense reelle deja constatee (sync API), false = previsionnel editable
    is_actual BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (client_id, year, month, platform)
);

CREATE INDEX IF NOT EXISTS idx_client_budgets_client_year ON client_budgets(client_id, year);
CREATE INDEX IF NOT EXISTS idx_client_budgets_year_month ON client_budgets(year, month);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION trg_client_budgets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS client_budgets_updated_at ON client_budgets;
CREATE TRIGGER client_budgets_updated_at
    BEFORE UPDATE ON client_budgets
    FOR EACH ROW EXECUTE FUNCTION trg_client_budgets_updated_at();

-- ============================================
-- 2. CLIENT_PROMOS — calendrier promo avec wordings et perf historique
-- ============================================
CREATE TABLE IF NOT EXISTS client_promos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    year INT NOT NULL CHECK (year BETWEEN 2020 AND 2100),
    month INT CHECK (month BETWEEN 1 AND 12),
    title TEXT NOT NULL, -- ex: "Saint-Valentin"
    emoji TEXT,          -- ex: 💝 (cosmetique pour l'UI)
    date_start DATE,
    date_end DATE,
    offer_text TEXT,     -- ex: "10€ de remise sur la collection"
    -- Wordings : array d'objets { label, text } (3 a 5 par promo typiquement)
    wordings JSONB DEFAULT '[]'::JSONB,
    -- Plateformes ciblees : array de strings ('google_ads', 'meta_ads', 'tiktok_ads')
    platforms JSONB DEFAULT '[]'::JSONB,
    -- Performances historiques : { spend, roas, revenue, orders, year_ref }
    performance JSONB DEFAULT '{}'::JSONB,
    status TEXT NOT NULL DEFAULT 'planned'
        CHECK (status IN ('planned', 'live', 'done', 'cancelled')),
    sort_order INT DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_promos_client_year ON client_promos(client_id, year);
CREATE INDEX IF NOT EXISTS idx_client_promos_month ON client_promos(year, month);
CREATE INDEX IF NOT EXISTS idx_client_promos_status ON client_promos(status);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION trg_client_promos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS client_promos_updated_at ON client_promos;
CREATE TRIGGER client_promos_updated_at
    BEFORE UPDATE ON client_promos
    FOR EACH ROW EXECUTE FUNCTION trg_client_promos_updated_at();

-- ============================================
-- 3. RLS — activer + policies
-- ============================================
ALTER TABLE client_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_promos ENABLE ROW LEVEL SECURITY;

-- ── client_budgets ──
-- READ : admin/staff de l'agence OU client qui a acces a ce client
DROP POLICY IF EXISTS "Read client_budgets via access" ON client_budgets;
CREATE POLICY "Read client_budgets via access"
    ON client_budgets FOR SELECT
    USING (user_can_access_client(client_id));

-- WRITE (INSERT/UPDATE/DELETE) : admin/staff seulement
DROP POLICY IF EXISTS "Admin/staff write client_budgets" ON client_budgets;
CREATE POLICY "Admin/staff write client_budgets"
    ON client_budgets FOR ALL
    USING (
        user_can_access_client(client_id)
        AND get_user_role() IN ('admin', 'staff')
    )
    WITH CHECK (
        user_can_access_client(client_id)
        AND get_user_role() IN ('admin', 'staff')
    );

-- ── client_promos ──
-- READ : admin/staff de l'agence OU client qui a acces
DROP POLICY IF EXISTS "Read client_promos via access" ON client_promos;
CREATE POLICY "Read client_promos via access"
    ON client_promos FOR SELECT
    USING (user_can_access_client(client_id));

-- WRITE : admin/staff seulement
DROP POLICY IF EXISTS "Admin/staff write client_promos" ON client_promos;
CREATE POLICY "Admin/staff write client_promos"
    ON client_promos FOR ALL
    USING (
        user_can_access_client(client_id)
        AND get_user_role() IN ('admin', 'staff')
    )
    WITH CHECK (
        user_can_access_client(client_id)
        AND get_user_role() IN ('admin', 'staff')
    );

-- ============================================
-- 4. IMPORT DATA — Emile & Co 2026 (depuis le fichier Jaemeson)
--
-- Decommente ce bloc UNE FOIS pour importer les budgets initiaux.
-- Verifie d'abord que les 6 marques existent dans `clients` avec ces noms exacts.
-- Si tes noms different (ex: "Nordic Ware" au lieu de "NW"), adapte le mapping.
--
-- DRY-RUN d'abord (commente le INSERT, run le SELECT pour verifier les IDs trouves) :
--   SELECT id, name, group_name FROM clients
--   WHERE name IN ('OXO', 'Marcato', 'Nordic Ware', 'Bamix', 'Vitamix', 'Emile Henry')
--   ORDER BY name;
--
-- Puis decommente le bloc INSERT ci-dessous pour importer.
-- ============================================

-- DO $$
-- DECLARE
--     v_oxo UUID;
--     v_marcato UUID;
--     v_nw UUID;
--     v_bamix UUID;
--     v_vitamix UUID;
--     v_emilehenry UUID;
-- BEGIN
--     SELECT id INTO v_oxo FROM clients WHERE name = 'OXO' LIMIT 1;
--     SELECT id INTO v_marcato FROM clients WHERE name = 'Marcato' LIMIT 1;
--     SELECT id INTO v_nw FROM clients WHERE name = 'Nordic Ware' LIMIT 1;
--     SELECT id INTO v_bamix FROM clients WHERE name = 'Bamix' LIMIT 1;
--     SELECT id INTO v_vitamix FROM clients WHERE name = 'Vitamix' LIMIT 1;
--     SELECT id INTO v_emilehenry FROM clients WHERE name = 'Emile Henry' LIMIT 1;
--
--     -- ── JANVIER : depenses reelles (is_actual=true) ──
--     INSERT INTO client_budgets (client_id, year, month, platform, amount, is_actual) VALUES
--     (v_oxo, 2026, 1, 'google_ads', 1074, true), (v_oxo, 2026, 1, 'meta_ads', 0, true),
--     (v_marcato, 2026, 1, 'google_ads', 1397, true), (v_marcato, 2026, 1, 'meta_ads', 0, true),
--     (v_nw, 2026, 1, 'google_ads', 1041, true), (v_nw, 2026, 1, 'meta_ads', 335, true),
--     (v_bamix, 2026, 1, 'google_ads', 767, true), (v_bamix, 2026, 1, 'meta_ads', 592, true),
--     (v_vitamix, 2026, 1, 'google_ads', 1265, true), (v_vitamix, 2026, 1, 'meta_ads', 0, true),
--     (v_emilehenry, 2026, 1, 'google_ads', 883, true), (v_emilehenry, 2026, 1, 'meta_ads', 0, true)
--     ON CONFLICT (client_id, year, month, platform) DO UPDATE SET amount = EXCLUDED.amount, is_actual = EXCLUDED.is_actual;
--
--     -- ── FEVRIER ──
--     INSERT INTO client_budgets (client_id, year, month, platform, amount, is_actual) VALUES
--     (v_oxo, 2026, 2, 'google_ads', 886, true), (v_oxo, 2026, 2, 'meta_ads', 0, true),
--     (v_marcato, 2026, 2, 'google_ads', 438, true), (v_marcato, 2026, 2, 'meta_ads', 0, true),
--     (v_nw, 2026, 2, 'google_ads', 501, true), (v_nw, 2026, 2, 'meta_ads', 233, true),
--     (v_bamix, 2026, 2, 'google_ads', 736, true), (v_bamix, 2026, 2, 'meta_ads', 81, true),
--     (v_vitamix, 2026, 2, 'google_ads', 540, true), (v_vitamix, 2026, 2, 'meta_ads', 0, true),
--     (v_emilehenry, 2026, 2, 'google_ads', 695, true), (v_emilehenry, 2026, 2, 'meta_ads', 0, true)
--     ON CONFLICT (client_id, year, month, platform) DO UPDATE SET amount = EXCLUDED.amount, is_actual = EXCLUDED.is_actual;
--
--     -- ── MARS ──
--     INSERT INTO client_budgets (client_id, year, month, platform, amount, is_actual) VALUES
--     (v_oxo, 2026, 3, 'google_ads', 762, true), (v_oxo, 2026, 3, 'meta_ads', 0, true),
--     (v_marcato, 2026, 3, 'google_ads', 557, true), (v_marcato, 2026, 3, 'meta_ads', 0, true),
--     (v_nw, 2026, 3, 'google_ads', 237, true), (v_nw, 2026, 3, 'meta_ads', 467, true),
--     (v_bamix, 2026, 3, 'google_ads', 845, true), (v_bamix, 2026, 3, 'meta_ads', 288, true),
--     (v_vitamix, 2026, 3, 'google_ads', 333, true), (v_vitamix, 2026, 3, 'meta_ads', 0, true),
--     (v_emilehenry, 2026, 3, 'google_ads', 670, true), (v_emilehenry, 2026, 3, 'meta_ads', 0, true)
--     ON CONFLICT (client_id, year, month, platform) DO UPDATE SET amount = EXCLUDED.amount, is_actual = EXCLUDED.is_actual;
--
--     -- ── AVRIL ──
--     INSERT INTO client_budgets (client_id, year, month, platform, amount, is_actual) VALUES
--     (v_oxo, 2026, 4, 'google_ads', 1181, true), (v_oxo, 2026, 4, 'meta_ads', 0, true),
--     (v_marcato, 2026, 4, 'google_ads', 1011, true), (v_marcato, 2026, 4, 'meta_ads', 0, true),
--     (v_nw, 2026, 4, 'google_ads', 71, true), (v_nw, 2026, 4, 'meta_ads', 205, true),
--     (v_bamix, 2026, 4, 'google_ads', 805, true), (v_bamix, 2026, 4, 'meta_ads', 414, true),
--     (v_vitamix, 2026, 4, 'google_ads', 85, true), (v_vitamix, 2026, 4, 'meta_ads', 0, true),
--     (v_emilehenry, 2026, 4, 'google_ads', 860, true), (v_emilehenry, 2026, 4, 'meta_ads', 0, true)
--     ON CONFLICT (client_id, year, month, platform) DO UPDATE SET amount = EXCLUDED.amount, is_actual = EXCLUDED.is_actual;
--
--     -- ── MAI ──
--     INSERT INTO client_budgets (client_id, year, month, platform, amount, is_actual) VALUES
--     (v_oxo, 2026, 5, 'google_ads', 1177, true), (v_oxo, 2026, 5, 'meta_ads', 0, true),
--     (v_marcato, 2026, 5, 'google_ads', 775, true), (v_marcato, 2026, 5, 'meta_ads', 0, true),
--     (v_nw, 2026, 5, 'google_ads', 220, true), (v_nw, 2026, 5, 'meta_ads', 865, true),
--     (v_bamix, 2026, 5, 'google_ads', 639, true), (v_bamix, 2026, 5, 'meta_ads', 805, true),
--     (v_vitamix, 2026, 5, 'google_ads', 130, true), (v_vitamix, 2026, 5, 'meta_ads', 0, true),
--     (v_emilehenry, 2026, 5, 'google_ads', 546, true), (v_emilehenry, 2026, 5, 'meta_ads', 0, true)
--     ON CONFLICT (client_id, year, month, platform) DO UPDATE SET amount = EXCLUDED.amount, is_actual = EXCLUDED.is_actual;
--
--     -- ── JUIN à DECEMBRE : previsionnel (is_actual=false) ──
--     -- JUIN
--     INSERT INTO client_budgets (client_id, year, month, platform, amount, is_actual) VALUES
--     (v_oxo, 2026, 6, 'google_ads', 1000, false), (v_oxo, 2026, 6, 'meta_ads', 0, false),
--     (v_marcato, 2026, 6, 'google_ads', 400, false), (v_marcato, 2026, 6, 'meta_ads', 0, false),
--     (v_nw, 2026, 6, 'google_ads', 250, false), (v_nw, 2026, 6, 'meta_ads', 150, false),
--     (v_bamix, 2026, 6, 'google_ads', 1300, false), (v_bamix, 2026, 6, 'meta_ads', 1300, false),
--     (v_vitamix, 2026, 6, 'google_ads', 150, false), (v_vitamix, 2026, 6, 'meta_ads', 30, false),
--     (v_emilehenry, 2026, 6, 'google_ads', 850, false), (v_emilehenry, 2026, 6, 'meta_ads', 0, false)
--     ON CONFLICT (client_id, year, month, platform) DO UPDATE SET amount = EXCLUDED.amount, is_actual = EXCLUDED.is_actual;
--
--     -- JUILLET
--     INSERT INTO client_budgets (client_id, year, month, platform, amount, is_actual) VALUES
--     (v_oxo, 2026, 7, 'google_ads', 1300, false), (v_oxo, 2026, 7, 'meta_ads', 0, false),
--     (v_marcato, 2026, 7, 'google_ads', 30, false), (v_marcato, 2026, 7, 'meta_ads', 0, false),
--     (v_nw, 2026, 7, 'google_ads', 30, false), (v_nw, 2026, 7, 'meta_ads', 30, false),
--     (v_bamix, 2026, 7, 'google_ads', 1900, false), (v_bamix, 2026, 7, 'meta_ads', 2050, false),
--     (v_vitamix, 2026, 7, 'google_ads', 30, false), (v_vitamix, 2026, 7, 'meta_ads', 30, false),
--     (v_emilehenry, 2026, 7, 'google_ads', 1050, false), (v_emilehenry, 2026, 7, 'meta_ads', 0, false)
--     ON CONFLICT (client_id, year, month, platform) DO UPDATE SET amount = EXCLUDED.amount, is_actual = EXCLUDED.is_actual;
--
--     -- AOUT
--     INSERT INTO client_budgets (client_id, year, month, platform, amount, is_actual) VALUES
--     (v_oxo, 2026, 8, 'google_ads', 200, false), (v_oxo, 2026, 8, 'meta_ads', 0, false),
--     (v_marcato, 2026, 8, 'google_ads', 30, false), (v_marcato, 2026, 8, 'meta_ads', 0, false),
--     (v_nw, 2026, 8, 'google_ads', 30, false), (v_nw, 2026, 8, 'meta_ads', 30, false),
--     (v_bamix, 2026, 8, 'google_ads', 200, false), (v_bamix, 2026, 8, 'meta_ads', 200, false),
--     (v_vitamix, 2026, 8, 'google_ads', 30, false), (v_vitamix, 2026, 8, 'meta_ads', 30, false),
--     (v_emilehenry, 2026, 8, 'google_ads', 200, false), (v_emilehenry, 2026, 8, 'meta_ads', 0, false)
--     ON CONFLICT (client_id, year, month, platform) DO UPDATE SET amount = EXCLUDED.amount, is_actual = EXCLUDED.is_actual;
--
--     -- SEPTEMBRE
--     INSERT INTO client_budgets (client_id, year, month, platform, amount, is_actual) VALUES
--     (v_oxo, 2026, 9, 'google_ads', 1000, false), (v_oxo, 2026, 9, 'meta_ads', 0, false),
--     (v_marcato, 2026, 9, 'google_ads', 1150, false), (v_marcato, 2026, 9, 'meta_ads', 0, false),
--     (v_nw, 2026, 9, 'google_ads', 1400, false), (v_nw, 2026, 9, 'meta_ads', 400, false),
--     (v_bamix, 2026, 9, 'google_ads', 1050, false), (v_bamix, 2026, 9, 'meta_ads', 1200, false),
--     (v_vitamix, 2026, 9, 'google_ads', 600, false), (v_vitamix, 2026, 9, 'meta_ads', 950, false),
--     (v_emilehenry, 2026, 9, 'google_ads', 1500, false), (v_emilehenry, 2026, 9, 'meta_ads', 0, false)
--     ON CONFLICT (client_id, year, month, platform) DO UPDATE SET amount = EXCLUDED.amount, is_actual = EXCLUDED.is_actual;
--
--     -- OCTOBRE
--     INSERT INTO client_budgets (client_id, year, month, platform, amount, is_actual) VALUES
--     (v_oxo, 2026, 10, 'google_ads', 1400, false), (v_oxo, 2026, 10, 'meta_ads', 0, false),
--     (v_marcato, 2026, 10, 'google_ads', 1650, false), (v_marcato, 2026, 10, 'meta_ads', 0, false),
--     (v_nw, 2026, 10, 'google_ads', 1960, false), (v_nw, 2026, 10, 'meta_ads', 530, false),
--     (v_bamix, 2026, 10, 'google_ads', 1500, false), (v_bamix, 2026, 10, 'meta_ads', 1750, false),
--     (v_vitamix, 2026, 10, 'google_ads', 830, false), (v_vitamix, 2026, 10, 'meta_ads', 1230, false),
--     (v_emilehenry, 2026, 10, 'google_ads', 3400, false), (v_emilehenry, 2026, 10, 'meta_ads', 0, false)
--     ON CONFLICT (client_id, year, month, platform) DO UPDATE SET amount = EXCLUDED.amount, is_actual = EXCLUDED.is_actual;
--
--     -- NOVEMBRE
--     INSERT INTO client_budgets (client_id, year, month, platform, amount, is_actual) VALUES
--     (v_oxo, 2026, 11, 'google_ads', 2020, false), (v_oxo, 2026, 11, 'meta_ads', 0, false),
--     (v_marcato, 2026, 11, 'google_ads', 2250, false), (v_marcato, 2026, 11, 'meta_ads', 0, false),
--     (v_nw, 2026, 11, 'google_ads', 2660, false), (v_nw, 2026, 11, 'meta_ads', 690, false),
--     (v_bamix, 2026, 11, 'google_ads', 2250, false), (v_bamix, 2026, 11, 'meta_ads', 2700, false),
--     (v_vitamix, 2026, 11, 'google_ads', 1130, false), (v_vitamix, 2026, 11, 'meta_ads', 1800, false),
--     (v_emilehenry, 2026, 11, 'google_ads', 5500, false), (v_emilehenry, 2026, 11, 'meta_ads', 0, false)
--     ON CONFLICT (client_id, year, month, platform) DO UPDATE SET amount = EXCLUDED.amount, is_actual = EXCLUDED.is_actual;
--
--     -- DECEMBRE
--     INSERT INTO client_budgets (client_id, year, month, platform, amount, is_actual) VALUES
--     (v_oxo, 2026, 12, 'google_ads', 1500, false), (v_oxo, 2026, 12, 'meta_ads', 0, false),
--     (v_marcato, 2026, 12, 'google_ads', 1812, false), (v_marcato, 2026, 12, 'meta_ads', 0, false),
--     (v_nw, 2026, 12, 'google_ads', 2100, false), (v_nw, 2026, 12, 'meta_ads', 565, false),
--     (v_bamix, 2026, 12, 'google_ads', 1858, false), (v_bamix, 2026, 12, 'meta_ads', 2470, false),
--     (v_vitamix, 2026, 12, 'google_ads', 877, false), (v_vitamix, 2026, 12, 'meta_ads', 1430, false),
--     (v_emilehenry, 2026, 12, 'google_ads', 3846, false), (v_emilehenry, 2026, 12, 'meta_ads', 0, false)
--     ON CONFLICT (client_id, year, month, platform) DO UPDATE SET amount = EXCLUDED.amount, is_actual = EXCLUDED.is_actual;
--
--     RAISE NOTICE 'Budgets Emile & Co 2026 importes : 144 lignes';
-- END $$;

-- ============================================
-- FIN
-- Verification post-execution :
--   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'
--     AND tablename IN ('client_budgets','client_promos');
--   SELECT COUNT(*) FROM client_budgets;
--   SELECT COUNT(*) FROM client_promos;
-- ============================================
