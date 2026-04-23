-- ============================================
-- 012 - CRM Unifie (Prospects <-> Clients)
-- Relie prospects et clients pour que Klarent & co
-- aient un chemin naturel du prospect gagne au client actif.
-- ============================================

-- ── 1. Lien prospect -> client ──
-- Permet de retrouver d'ou vient un client (quel prospect il etait)
-- et sert de base pour la fiche unifiee.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_clients_prospect ON clients(prospect_id);

-- ── 2. Infos contrat sur la fiche CRM (prospects = source de verite) ──
-- Quand un prospect signe, on enregistre ici les infos d'engagement.
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_signed_at DATE;                   -- Date de signature
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_validated BOOLEAN DEFAULT false;  -- Signe par les 2 parties ?
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_object TEXT;                      -- "Pack Full Acquisition", "Creation site web"...
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_type TEXT
    CHECK (contract_type IN ('mensuel', 'one_shot', 'hybride'));
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_status TEXT DEFAULT 'actif'
    CHECK (contract_status IN ('actif', 'en_pause', 'termine'));

-- Finances
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_monthly_amount NUMERIC(10,2);
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_one_shot_amount NUMERIC(10,2);
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_billing_frequency TEXT DEFAULT 'mensuelle'
    CHECK (contract_billing_frequency IN ('mensuelle', 'trimestrielle', 'annuelle', 'unique'));
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_payment_terms_days INTEGER; -- delai de paiement en jours

-- Duree & engagement
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_start_date DATE;                  -- Debut effectif de la prestation
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_firm_period_months INTEGER;       -- Duree de la periode ferme (ex: 3 mois)
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_firm_end_date DATE;               -- Fin de la periode ferme

-- Reconduction & resiliation
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_renewal_type TEXT DEFAULT 'non_defini'
    CHECK (contract_renewal_type IN ('tacite', 'expresse', 'aucune', 'non_defini'));
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_renewal_duration_months INTEGER;  -- Duree des reconductions (3 mois pour Klarent, 12 pour MJ Renov)
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_notice_days INTEGER;              -- Preavis de resiliation en jours

-- Docs & notes
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_pdf_url TEXT;                     -- Lien vers le PDF du contrat signe
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contract_notes TEXT;                       -- Notes libres / clauses speciales

-- ── 3. Stage client (pipeline post-signature) ──
-- On etend l'enum relationship_status pour matcher le nouveau kanban.
-- 'signe' = vient d'etre converti, onboarding a programmer
-- 'onboarding' = collecte brief, setup en cours
-- 'active' = en prod, deja existant
-- 'renouvellement' = abo recurrent arrivant a echeance
-- 'churned' = ancien client
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_relationship_status_check;
ALTER TABLE clients ADD CONSTRAINT clients_relationship_status_check
    CHECK (relationship_status IN ('prospect', 'signe', 'onboarding', 'active', 'paused', 'renouvellement', 'churned'));

-- ── 4. Helper: vue CRM unifiee ──
-- Retourne chaque contact (prospect OU client) avec une forme normalisee
-- pour alimenter le kanban unifie cote UI.
CREATE OR REPLACE VIEW crm_contacts AS
SELECT
    p.id                        AS id,
    'prospect'                  AS entity_type,
    p.agency_id                 AS agency_id,
    p.company_name              AS company_name,
    p.contact_first_name        AS contact_first_name,
    p.contact_last_name         AS contact_last_name,
    p.contact_email             AS contact_email,
    p.contact_phone             AS contact_phone,
    p.stage                     AS prospect_stage,
    NULL::TEXT                  AS client_stage,
    p.relationship_type         AS relationship_type,
    p.priority                  AS priority,
    p.source                    AS source,
    p.next_action               AS next_action,
    p.next_action_date          AS next_action_date,
    p.contract_signed_at        AS contract_signed_at,
    p.contract_monthly_amount   AS contract_monthly_amount,
    p.contract_one_shot_amount  AS contract_one_shot_amount,
    p.contract_type             AS contract_type,
    p.contract_status           AS contract_status,
    p.won_amount                AS won_amount,
    p.converted_client_id       AS converted_client_id,
    p.created_at                AS created_at,
    p.updated_at                AS updated_at
FROM prospects p

UNION ALL

SELECT
    c.id                        AS id,
    'client'                    AS entity_type,
    c.agency_id                 AS agency_id,
    c.name                      AS company_name,
    NULL::TEXT                  AS contact_first_name,
    c.contact_name              AS contact_last_name,
    c.contact_email             AS contact_email,
    c.contact_phone             AS contact_phone,
    NULL::TEXT                  AS prospect_stage,
    c.relationship_status       AS client_stage,
    NULL::TEXT                  AS relationship_type,
    NULL::TEXT                  AS priority,
    NULL::TEXT                  AS source,
    NULL::TEXT                  AS next_action,
    NULL::DATE                  AS next_action_date,
    NULL::DATE                  AS contract_signed_at,
    NULL::NUMERIC               AS contract_monthly_amount,
    NULL::NUMERIC               AS contract_one_shot_amount,
    NULL::TEXT                  AS contract_type,
    NULL::TEXT                  AS contract_status,
    NULL::NUMERIC               AS won_amount,
    NULL::UUID                  AS converted_client_id,
    c.created_at                AS created_at,
    c.created_at                AS updated_at
FROM clients c
WHERE c.prospect_id IS NULL;
-- Note: on exclut les clients deja relies a un prospect pour eviter les doublons.
-- La source de verite CRM devient le prospect (qui porte les infos contrat).
