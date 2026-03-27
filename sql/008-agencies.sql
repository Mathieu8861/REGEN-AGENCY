-- =============================================
-- 008-agencies.sql
-- Agency profile system: identity, services,
-- documents, team members, AI knowledge base
-- =============================================

-- Table: agencies (main agency profile)
CREATE TABLE IF NOT EXISTS agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    siret TEXT,
    address TEXT,
    city TEXT,
    postal_code TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    logo_url TEXT,
    -- AI knowledge base fields (stored directly, not in separate table)
    tone TEXT DEFAULT 'professionnel', -- professionnel, decontracte, formel
    email_signature TEXT,
    commercial_rules TEXT, -- regles commerciales en texte libre (markdown)
    methodology TEXT, -- methodologie de travail
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: agency_services (services offered with pricing)
CREATE TABLE IF NOT EXISTS agency_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. "Creation site web sur-mesure"
    category TEXT NOT NULL, -- e.g. "creation_site", "google_ads", "seo", "meta_ads", "tiktok_ads", "formation", "consulting"
    description TEXT,
    price_min NUMERIC, -- fourchette basse
    price_max NUMERIC, -- fourchette haute
    price_type TEXT DEFAULT 'one_shot', -- one_shot, monthly, daily
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: agency_documents (reference docs for AI)
CREATE TABLE IF NOT EXISTS agency_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT,
    category TEXT DEFAULT 'reference', -- reference, template, proposal_example, brand
    description TEXT,
    -- Extracted text content for AI to use
    extracted_text TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: agency_members (team members)
CREATE TABLE IF NOT EXISTS agency_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'member', -- admin, member, partner
    title TEXT, -- e.g. "Directeur", "Chef de projet", "Consultante SEO"
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add agency_id to prospects table
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id);

-- Disable RLS (development)
ALTER TABLE agencies DISABLE ROW LEVEL SECURITY;
ALTER TABLE agency_services DISABLE ROW LEVEL SECURITY;
ALTER TABLE agency_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE agency_members DISABLE ROW LEVEL SECURITY;

-- Insert default Regen Agency profile
INSERT INTO agencies (name, siret, address, city, postal_code, email, phone, website, tone, email_signature, commercial_rules, methodology)
VALUES (
    'Regen Agency',
    '985 275 460 00014',
    '60 rue Francois 1er',
    'Paris',
    '75008',
    'contact.regenagency@gmail.com',
    NULL,
    'https://regen-agency.vercel.app',
    'professionnel',
    'Cordialement,
Mathieu Duval
Regen Agency
contact.regenagency@gmail.com
60 rue Francois 1er, 75008 Paris',
    '- Proposer 2 options site web quand le client a deja un site (refonte existant vs recreation)
- Formules modulaires quand pas de site existant (vitrine + e-commerce + reservation)
- Engagement minimum 3 mois pour le recurrent
- Toujours proposer un setup one-shot + recurrent mensuel
- TVA non applicable (article 293B du CGI) si applicable',
    '1. Collecte d''informations (liens, docs, echanges)
2. Analyse et enrichissement IA
3. Premier echange / formulaire de renseignement
4. Synthese globale
5. Proposition commerciale personnalisee
6. Signature et lancement'
)
ON CONFLICT DO NOTHING;

-- Insert default Regen Agency members
INSERT INTO agency_members (agency_id, name, email, role, title) VALUES
((SELECT id FROM agencies WHERE name = 'Regen Agency' LIMIT 1), 'Mathieu', 'contact.regenagency@gmail.com', 'admin', 'Co-fondateur'),
((SELECT id FROM agencies WHERE name = 'Regen Agency' LIMIT 1), 'Associe', NULL, 'admin', 'Co-fondateur');

-- Insert default Regen Agency services
INSERT INTO agency_services (agency_id, category, name, description, price_min, price_max, price_type, sort_order) VALUES
((SELECT id FROM agencies WHERE name = 'Regen Agency' LIMIT 1), 'creation_site', 'Refonte site web sur-mesure', 'Reconstruction integrale avec design sur-mesure, performances optimisees', 3000, 6000, 'one_shot', 1),
((SELECT id FROM agencies WHERE name = 'Regen Agency' LIMIT 1), 'creation_site', 'Refonte WordPress / Elementor', 'Modernisation du site existant avec refonte design et fonctionnalites', 3500, 5500, 'one_shot', 2),
((SELECT id FROM agencies WHERE name = 'Regen Agency' LIMIT 1), 'creation_site', 'Module e-commerce', 'Ajout de la vente en ligne (catalogue, panier, paiement)', 1500, 3000, 'one_shot', 3),
((SELECT id FROM agencies WHERE name = 'Regen Agency' LIMIT 1), 'creation_site', 'Module reservation', 'Systeme de reservation iCalendar avec disponibilites temps reel', 500, 1000, 'one_shot', 4),
((SELECT id FROM agencies WHERE name = 'Regen Agency' LIMIT 1), 'creation_site', 'Module multilingue', 'Traduction et adaptation du site pour audience internationale', 400, 800, 'one_shot', 5),
((SELECT id FROM agencies WHERE name = 'Regen Agency' LIMIT 1), 'google_ads', 'Setup Google Ads complet', 'Audit, creation compte, campagnes Search + Performance Max, tracking', 1500, 2500, 'one_shot', 6),
((SELECT id FROM agencies WHERE name = 'Regen Agency' LIMIT 1), 'google_ads', 'Gestion Google Ads mensuelle', 'Optimisation continue, reporting, A/B testing', 400, 800, 'monthly', 7),
((SELECT id FROM agencies WHERE name = 'Regen Agency' LIMIT 1), 'seo', 'Audit SEO complet', 'Audit technique, semantique et concurrentiel', 250, 500, 'one_shot', 8),
((SELECT id FROM agencies WHERE name = 'Regen Agency' LIMIT 1), 'seo', 'SEO mensuel (articles + suivi)', 'Redaction articles optimises, suivi positions, reporting', 300, 600, 'monthly', 9),
((SELECT id FROM agencies WHERE name = 'Regen Agency' LIMIT 1), 'meta_ads', 'Setup Meta Ads', 'Creation campagnes Facebook/Instagram, audiences, creatifs', 1000, 2000, 'one_shot', 10),
((SELECT id FROM agencies WHERE name = 'Regen Agency' LIMIT 1), 'meta_ads', 'Gestion Meta Ads mensuelle', 'Optimisation, scaling, reporting', 400, 700, 'monthly', 11),
((SELECT id FROM agencies WHERE name = 'Regen Agency' LIMIT 1), 'tiktok_ads', 'Setup TikTok Ads', 'Creation compte, campagnes, audiences', 1000, 2000, 'one_shot', 12),
((SELECT id FROM agencies WHERE name = 'Regen Agency' LIMIT 1), 'formation', 'Formation marketing digital', 'Formation personnalisee (SEO, Ads, reseaux sociaux)', 500, 1500, 'one_shot', 13),
((SELECT id FROM agencies WHERE name = 'Regen Agency' LIMIT 1), 'consulting', 'Consulting strategie digitale', 'Audit global et recommandations strategiques', 500, 2000, 'one_shot', 14),
((SELECT id FROM agencies WHERE name = 'Regen Agency' LIMIT 1), 'creation_site', 'Maintenance site mensuelle', 'Mises a jour, sauvegardes, monitoring, support', 100, 200, 'monthly', 15),
((SELECT id FROM agencies WHERE name = 'Regen Agency' LIMIT 1), 'creation_site', 'Migration hebergement', 'Transfert site, emails, DNS vers nouvel hebergeur', 300, 600, 'one_shot', 16);
