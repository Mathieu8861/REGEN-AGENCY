-- ============================================
-- 010 - PROSPECT CONTEXT (services pipeline + follow-ups)
-- Tracks what services are involved, their status,
-- and follow-up notes so the AI knows exactly where we are.
-- ============================================

-- ── 1. Add AI context field to prospects ──
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS ai_context TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS relationship_type TEXT DEFAULT 'prospect'
    CHECK (relationship_type IN ('prospect', 'client_existant', 'ancien_client', 'partenaire'));

-- ── 2. Prospect services (pipeline per service) ──
CREATE TABLE IF NOT EXISTS prospect_services (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL,
    service_label TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'besoin_exprime'
        CHECK (status IN (
            'besoin_exprime', 'devis_envoye', 'devis_accepte', 'acompte_paye',
            'en_cours', 'livre', 'facture_envoyee', 'paye', 'recurrent', 'annule'
        )),
    price_ht NUMERIC(10,2),
    started_at DATE,
    delivered_at DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospect_services_prospect ON prospect_services(prospect_id);

-- ── 3. Prospect follow-up notes ──
CREATE TABLE IF NOT EXISTS prospect_follow_ups (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    category TEXT DEFAULT 'general'
        CHECK (category IN ('general', 'commercial', 'technique', 'facturation', 'livraison', 'demande_client')),
    created_by TEXT DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospect_follow_ups_prospect ON prospect_follow_ups(prospect_id);

-- ── 4. RLS ──
ALTER TABLE prospect_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prospect_services_all" ON prospect_services FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "prospect_follow_ups_all" ON prospect_follow_ups FOR ALL USING (true) WITH CHECK (true);
