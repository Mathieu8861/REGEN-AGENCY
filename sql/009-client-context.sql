-- ============================================
-- 009 - CLIENT CONTEXT (for AI awareness)
-- Tracks relationship status, delivered services,
-- ongoing projects, and follow-up notes.
-- ============================================

-- ── 1. Add context columns to clients ──
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sector TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS relationship_status TEXT DEFAULT 'active'
    CHECK (relationship_status IN ('prospect', 'onboarding', 'active', 'paused', 'churned'));
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ai_summary TEXT; -- free text context for the AI

-- ── 2. Client services (what we've done / are doing / are discussing) ──
CREATE TABLE IF NOT EXISTS client_services (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL, -- 'site_web', 'hebergement', 'google_ads', 'meta_ads', 'seo', 'formation', etc.
    service_label TEXT NOT NULL, -- human-readable: "Création site vitrine", "Campagne Google Ads"
    status TEXT NOT NULL DEFAULT 'discussion'
        CHECK (status IN ('discussion', 'devis_envoye', 'en_cours', 'livre', 'recurrent', 'annule')),
    price_ht NUMERIC(10,2),
    started_at DATE,
    delivered_at DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_services_client ON client_services(client_id);

-- ── 3. Client follow-up notes (timeline for AI context) ──
CREATE TABLE IF NOT EXISTS client_follow_ups (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    category TEXT DEFAULT 'general'
        CHECK (category IN ('general', 'commercial', 'technique', 'facturation', 'livraison', 'demande_client')),
    created_by TEXT DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_follow_ups_client ON client_follow_ups(client_id);

-- ── 4. Helper view: full client context for AI injection ──
CREATE OR REPLACE VIEW client_ai_context AS
SELECT
    c.id AS client_id,
    c.name,
    c.website,
    c.platform,
    c.contact_name,
    c.contact_email,
    c.contact_phone,
    c.sector,
    c.relationship_status,
    c.ai_summary,
    -- Aggregate services
    COALESCE(
        (SELECT json_agg(json_build_object(
            'service', cs.service_label,
            'type', cs.service_type,
            'status', cs.status,
            'price_ht', cs.price_ht,
            'started_at', cs.started_at,
            'delivered_at', cs.delivered_at,
            'notes', cs.notes
        ) ORDER BY cs.created_at)
        FROM client_services cs WHERE cs.client_id = c.id),
        '[]'::json
    ) AS services,
    -- Aggregate last 10 follow-ups
    COALESCE(
        (SELECT json_agg(json_build_object(
            'date', to_char(cf.created_at, 'DD/MM/YYYY'),
            'category', cf.category,
            'note', cf.note
        ) ORDER BY cf.created_at DESC)
        FROM (SELECT * FROM client_follow_ups WHERE client_id = c.id ORDER BY created_at DESC LIMIT 10) cf),
        '[]'::json
    ) AS recent_follow_ups
FROM clients c;

-- ── 5. RLS ──
ALTER TABLE client_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_services_all" ON client_services FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "client_follow_ups_all" ON client_follow_ups FOR ALL USING (true) WITH CHECK (true);
