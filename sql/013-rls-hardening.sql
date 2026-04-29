-- =============================================
-- 013-rls-hardening.sql
-- Active proprement RLS sur les tables previousement exposees publiquement
-- (warnings critical Supabase : prospect_*, agency_*, client_services, client_follow_ups)
--
-- Strategie :
--   - admin/staff de l'agence : ALL acces sur les ressources de leur agence
--   - clients (role='client') : pas d'acces aux prospects/agency, acces aux client_* via user_can_access_client()
--   - anon (sans auth) : SELECT/INSERT controles sur prospect_forms et prospect_form_responses
--     (necessaire pour la page publique prospect-form.html)
--
-- Run AFTER 012-crm-unified.sql in Supabase SQL Editor
-- Idempotent : peut etre rerun sans casse (DROP IF EXISTS sur toutes les policies).
-- =============================================

-- ============================================
-- 1. ENABLE RLS sur les tables qui etaient DISABLED
-- ============================================
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_form_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_members ENABLE ROW LEVEL SECURITY;
-- prospect_services, prospect_follow_ups, client_services, client_follow_ups
-- sont deja ENABLED mais avec des policies "USING true" (equivalent disabled) -> DROP plus bas.

-- ============================================
-- 2. DROP des policies trop permissives existantes
-- ============================================
DROP POLICY IF EXISTS "client_services_all" ON client_services;
DROP POLICY IF EXISTS "client_follow_ups_all" ON client_follow_ups;
DROP POLICY IF EXISTS "prospect_services_all" ON prospect_services;
DROP POLICY IF EXISTS "prospect_follow_ups_all" ON prospect_follow_ups;

-- ============================================
-- 3. PROSPECTS (filtre par agency_id direct)
-- ============================================
DROP POLICY IF EXISTS "Admin/staff manage agency prospects" ON prospects;
CREATE POLICY "Admin/staff manage agency prospects"
    ON prospects FOR ALL
    USING (
        agency_id = get_user_agency_id()
        AND get_user_role() IN ('admin', 'staff')
    )
    WITH CHECK (
        agency_id = get_user_agency_id()
        AND get_user_role() IN ('admin', 'staff')
    );

-- ============================================
-- 4. PROSPECT_LINKS / PROSPECT_ACTIVITIES / PROSPECT_DOCUMENTS
--    (acces via prospect.agency_id)
-- ============================================
DROP POLICY IF EXISTS "Admin/staff manage prospect_links" ON prospect_links;
CREATE POLICY "Admin/staff manage prospect_links"
    ON prospect_links FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM prospects p
            WHERE p.id = prospect_id
              AND p.agency_id = get_user_agency_id()
              AND get_user_role() IN ('admin', 'staff')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM prospects p
            WHERE p.id = prospect_id
              AND p.agency_id = get_user_agency_id()
              AND get_user_role() IN ('admin', 'staff')
        )
    );

DROP POLICY IF EXISTS "Admin/staff manage prospect_activities" ON prospect_activities;
CREATE POLICY "Admin/staff manage prospect_activities"
    ON prospect_activities FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM prospects p
            WHERE p.id = prospect_id
              AND p.agency_id = get_user_agency_id()
              AND get_user_role() IN ('admin', 'staff')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM prospects p
            WHERE p.id = prospect_id
              AND p.agency_id = get_user_agency_id()
              AND get_user_role() IN ('admin', 'staff')
        )
    );

DROP POLICY IF EXISTS "Admin/staff manage prospect_documents" ON prospect_documents;
CREATE POLICY "Admin/staff manage prospect_documents"
    ON prospect_documents FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM prospects p
            WHERE p.id = prospect_id
              AND p.agency_id = get_user_agency_id()
              AND get_user_role() IN ('admin', 'staff')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM prospects p
            WHERE p.id = prospect_id
              AND p.agency_id = get_user_agency_id()
              AND get_user_role() IN ('admin', 'staff')
        )
    );

DROP POLICY IF EXISTS "Admin/staff manage prospect_services" ON prospect_services;
CREATE POLICY "Admin/staff manage prospect_services"
    ON prospect_services FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM prospects p
            WHERE p.id = prospect_id
              AND p.agency_id = get_user_agency_id()
              AND get_user_role() IN ('admin', 'staff')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM prospects p
            WHERE p.id = prospect_id
              AND p.agency_id = get_user_agency_id()
              AND get_user_role() IN ('admin', 'staff')
        )
    );

DROP POLICY IF EXISTS "Admin/staff manage prospect_follow_ups" ON prospect_follow_ups;
CREATE POLICY "Admin/staff manage prospect_follow_ups"
    ON prospect_follow_ups FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM prospects p
            WHERE p.id = prospect_id
              AND p.agency_id = get_user_agency_id()
              AND get_user_role() IN ('admin', 'staff')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM prospects p
            WHERE p.id = prospect_id
              AND p.agency_id = get_user_agency_id()
              AND get_user_role() IN ('admin', 'staff')
        )
    );

-- ============================================
-- 5. PROSPECT_FORMS
--    Admin : ALL acces via agency
--    Anon  : SELECT seulement si is_active = true (page publique prospect-form.html)
-- ============================================
DROP POLICY IF EXISTS "Admin/staff manage prospect_forms" ON prospect_forms;
CREATE POLICY "Admin/staff manage prospect_forms"
    ON prospect_forms FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM prospects p
            WHERE p.id = prospect_id
              AND p.agency_id = get_user_agency_id()
              AND get_user_role() IN ('admin', 'staff')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM prospects p
            WHERE p.id = prospect_id
              AND p.agency_id = get_user_agency_id()
              AND get_user_role() IN ('admin', 'staff')
        )
    );

DROP POLICY IF EXISTS "Public can read active forms" ON prospect_forms;
CREATE POLICY "Public can read active forms"
    ON prospect_forms FOR SELECT
    USING (is_active = true);

-- ============================================
-- 6. PROSPECT_FORM_RESPONSES
--    Admin : SELECT/UPDATE/DELETE via agency
--    Anon  : INSERT seulement si le form correspondant est is_active
-- ============================================
DROP POLICY IF EXISTS "Admin/staff read prospect_form_responses" ON prospect_form_responses;
CREATE POLICY "Admin/staff read prospect_form_responses"
    ON prospect_form_responses FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM prospects p
            WHERE p.id = prospect_id
              AND p.agency_id = get_user_agency_id()
              AND get_user_role() IN ('admin', 'staff')
        )
    );

DROP POLICY IF EXISTS "Admin/staff modify prospect_form_responses" ON prospect_form_responses;
CREATE POLICY "Admin/staff modify prospect_form_responses"
    ON prospect_form_responses FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM prospects p
            WHERE p.id = prospect_id
              AND p.agency_id = get_user_agency_id()
              AND get_user_role() IN ('admin', 'staff')
        )
    );

-- INSERT public : on verifie que le form_id pointe vers un form actif
-- (le prospect_id doit aussi correspondre au prospect_id du form, secu defense en profondeur)
DROP POLICY IF EXISTS "Public can submit form responses" ON prospect_form_responses;
CREATE POLICY "Public can submit form responses"
    ON prospect_form_responses FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM prospect_forms f
            WHERE f.id = form_id
              AND f.is_active = true
              AND f.prospect_id = prospect_id
        )
    );

-- ============================================
-- 7. CLIENT_SERVICES / CLIENT_FOLLOW_UPS
--    Acces via user_can_access_client() (deja utilise pour clients/orders/etc)
-- ============================================
DROP POLICY IF EXISTS "Users access client_services via client" ON client_services;
CREATE POLICY "Users access client_services via client"
    ON client_services FOR ALL
    USING (user_can_access_client(client_id))
    WITH CHECK (user_can_access_client(client_id));

DROP POLICY IF EXISTS "Users access client_follow_ups via client" ON client_follow_ups;
CREATE POLICY "Users access client_follow_ups via client"
    ON client_follow_ups FOR ALL
    USING (user_can_access_client(client_id))
    WITH CHECK (user_can_access_client(client_id));

-- ============================================
-- 8. AGENCIES (re-ENABLE car DISABLE en 008)
-- ============================================
DROP POLICY IF EXISTS "Users can read own agency" ON agencies;
CREATE POLICY "Users can read own agency"
    ON agencies FOR SELECT
    USING (id = get_user_agency_id());

DROP POLICY IF EXISTS "Admin can update own agency" ON agencies;
CREATE POLICY "Admin can update own agency"
    ON agencies FOR UPDATE
    USING (id = get_user_agency_id() AND get_user_role() = 'admin')
    WITH CHECK (id = get_user_agency_id() AND get_user_role() = 'admin');

-- ============================================
-- 9. AGENCY_SERVICES / AGENCY_DOCUMENTS / AGENCY_MEMBERS
--    Admin/staff de l'agence : ALL acces
-- ============================================
DROP POLICY IF EXISTS "Admin/staff manage agency_services" ON agency_services;
CREATE POLICY "Admin/staff manage agency_services"
    ON agency_services FOR ALL
    USING (
        agency_id = get_user_agency_id()
        AND get_user_role() IN ('admin', 'staff')
    )
    WITH CHECK (
        agency_id = get_user_agency_id()
        AND get_user_role() IN ('admin', 'staff')
    );

DROP POLICY IF EXISTS "Admin/staff manage agency_documents" ON agency_documents;
CREATE POLICY "Admin/staff manage agency_documents"
    ON agency_documents FOR ALL
    USING (
        agency_id = get_user_agency_id()
        AND get_user_role() IN ('admin', 'staff')
    )
    WITH CHECK (
        agency_id = get_user_agency_id()
        AND get_user_role() IN ('admin', 'staff')
    );

DROP POLICY IF EXISTS "Admin/staff manage agency_members" ON agency_members;
CREATE POLICY "Admin/staff manage agency_members"
    ON agency_members FOR ALL
    USING (
        agency_id = get_user_agency_id()
        AND get_user_role() IN ('admin', 'staff')
    )
    WITH CHECK (
        agency_id = get_user_agency_id()
        AND get_user_role() IN ('admin', 'staff')
    );

-- ============================================
-- FIN
-- Verification post-execution :
--   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'
--     AND tablename IN ('prospects','prospect_links','prospect_activities',
--       'prospect_documents','prospect_forms','prospect_form_responses',
--       'prospect_services','prospect_follow_ups','client_services',
--       'client_follow_ups','agencies','agency_services','agency_documents',
--       'agency_members');
--   -> rowsecurity = true partout
-- ============================================
