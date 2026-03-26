-- ============================================
-- REGEN AGENCY - Module Prospects (CRM)
-- Run AFTER 006-spend-summary.sql
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROSPECTS (fiche prospect principale)
-- ============================================
CREATE TABLE prospects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

    -- Entreprise
    company_name TEXT NOT NULL,
    company_website TEXT,
    company_sector TEXT,
    company_size TEXT CHECK (company_size IN ('tpe', 'pme', 'eti', 'grand_groupe')),
    company_siret TEXT,
    company_address TEXT,

    -- Contact principal
    contact_first_name TEXT,
    contact_last_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    contact_position TEXT,

    -- Pipeline
    stage TEXT NOT NULL DEFAULT 'nouveau' CHECK (stage IN (
        'nouveau', 'qualifie', 'premier_echange',
        'proposition_envoyee', 'gagne', 'perdu'
    )),

    -- Source & attribution
    source TEXT CHECK (source IN (
        'site_web', 'linkedin', 'reseau', 'email_froid',
        'recommandation', 'salon', 'appel_entrant', 'autre'
    )),
    source_detail TEXT,

    -- Budget & besoins
    budget_estimate NUMERIC(12,2),
    budget_currency TEXT DEFAULT 'EUR',
    needs_summary TEXT,
    services_interested TEXT[],

    -- Affectation
    assigned_to TEXT,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    score INTEGER DEFAULT 0 CHECK (score BETWEEN 0 AND 100),

    -- Firefly transcript
    firefly_transcript TEXT,
    firefly_date TIMESTAMPTZ,
    firefly_summary TEXT,

    -- Email
    email_draft TEXT,
    email_subject TEXT,
    email_sent_at TIMESTAMPTZ,

    -- Resultat
    lost_reason TEXT,
    won_amount NUMERIC(12,2),
    converted_client_id UUID REFERENCES clients(id),

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prospects_agency ON prospects(agency_id);
CREATE INDEX idx_prospects_stage ON prospects(stage);
CREATE INDEX idx_prospects_assigned ON prospects(assigned_to);
CREATE INDEX idx_prospects_created ON prospects(created_at DESC);

-- ============================================
-- 2. PROSPECT_LINKS (liens sociaux/web/legaux)
-- ============================================
CREATE TABLE prospect_links (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    link_type TEXT NOT NULL CHECK (link_type IN (
        'website', 'linkedin_company', 'linkedin_contact',
        'facebook', 'instagram', 'tiktok', 'twitter',
        'pappers', 'societe_com', 'google_maps', 'autre'
    )),
    url TEXT NOT NULL,
    label TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prospect_links_prospect ON prospect_links(prospect_id);

-- ============================================
-- 3. PROSPECT_ACTIVITIES (timeline CRM)
-- ============================================
CREATE TABLE prospect_activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN (
        'note', 'call', 'email_sent', 'email_received',
        'meeting', 'status_change', 'document_added',
        'form_response', 'ai_analysis', 'task', 'autre'
    )),
    title TEXT NOT NULL,
    content TEXT,
    metadata JSONB DEFAULT '{}',
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prospect_activities_prospect ON prospect_activities(prospect_id);
CREATE INDEX idx_prospect_activities_created ON prospect_activities(created_at DESC);

-- ============================================
-- 4. PROSPECT_DOCUMENTS (fichiers uploades)
-- ============================================
CREATE TABLE prospect_documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    category TEXT DEFAULT 'autre' CHECK (category IN (
        'brief', 'charte_graphique', 'devis', 'proposition',
        'contrat', 'analyse', 'rapport', 'autre'
    )),
    uploaded_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prospect_documents_prospect ON prospect_documents(prospect_id);

-- ============================================
-- 5. PROSPECT_FORMS (formulaires publics)
-- ============================================
CREATE TABLE prospect_forms (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    token UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    form_title TEXT DEFAULT 'Questionnaire prospect',
    form_fields JSONB NOT NULL DEFAULT '[
        {"key":"company_name","label":"Nom de votre entreprise","type":"text","required":true},
        {"key":"website","label":"Site web","type":"url","required":false},
        {"key":"contact_name","label":"Votre nom complet","type":"text","required":true},
        {"key":"contact_email","label":"Email de contact","type":"email","required":true},
        {"key":"contact_phone","label":"Telephone","type":"tel","required":false},
        {"key":"needs","label":"Decrivez vos besoins","type":"textarea","required":true},
        {"key":"budget","label":"Budget estime (EUR/mois)","type":"number","required":false},
        {"key":"timeline","label":"Delai souhaite","type":"select","options":["Urgent (< 1 mois)","Court terme (1-3 mois)","Moyen terme (3-6 mois)","Pas de rush"],"required":false},
        {"key":"services","label":"Services souhaites","type":"checkbox","options":["Google Ads","Meta Ads","SEO","Creation site web","TikTok Ads","Formation","Autre"],"required":false},
        {"key":"current_situation","label":"Situation actuelle (ads, site, etc.)","type":"textarea","required":false}
    ]'::JSONB,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    max_responses INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prospect_forms_token ON prospect_forms(token);
CREATE INDEX idx_prospect_forms_prospect ON prospect_forms(prospect_id);

-- ============================================
-- 6. PROSPECT_FORM_RESPONSES (reponses)
-- ============================================
CREATE TABLE prospect_form_responses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    form_id UUID NOT NULL REFERENCES prospect_forms(id) ON DELETE CASCADE,
    prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    response_data JSONB NOT NULL DEFAULT '{}',
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prospect_form_responses_form ON prospect_form_responses(form_id);
CREATE INDEX idx_prospect_form_responses_prospect ON prospect_form_responses(prospect_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_prospect_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prospect_updated_at
    BEFORE UPDATE ON prospects
    FOR EACH ROW EXECUTE FUNCTION update_prospect_timestamp();

-- Auto-log stage changes
CREATE OR REPLACE FUNCTION log_prospect_stage_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
        INSERT INTO prospect_activities (
            prospect_id, activity_type, title, content, metadata, created_by
        ) VALUES (
            NEW.id,
            'status_change',
            'Changement de statut',
            OLD.stage || ' → ' || NEW.stage,
            jsonb_build_object('from_stage', OLD.stage, 'to_stage', NEW.stage),
            'system'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prospect_stage_changed
    AFTER UPDATE OF stage ON prospects
    FOR EACH ROW EXECUTE FUNCTION log_prospect_stage_change();

-- Auto-log form responses
CREATE OR REPLACE FUNCTION log_form_response_activity()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO prospect_activities (
        prospect_id, activity_type, title, content, created_by
    ) VALUES (
        NEW.prospect_id,
        'form_response',
        'Formulaire rempli par le prospect',
        'Reponse soumise via le formulaire public',
        'system'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER form_response_activity
    AFTER INSERT ON prospect_form_responses
    FOR EACH ROW EXECUTE FUNCTION log_form_response_activity();

-- ============================================
-- DISABLE RLS (dev mode, comme les autres tables)
-- ============================================
ALTER TABLE prospects DISABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_links DISABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_forms DISABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_form_responses DISABLE ROW LEVEL SECURITY;
