-- =============================================
-- 018-rls-reenable.sql
-- Re-active RLS sur les 6 tables flaggees par Supabase (08/06/2026) :
--   clients, client_users, integrations, ad_accounts, ad_campaigns, ad_daily_metrics
--
-- Pourquoi elles etaient DISABLED : pendant le debug "donnees fantomes"
-- (avant le fix auth admin de fin avril), l'admin n'avait pas de session
-- Supabase Auth → RLS bloquait tout → un DISABLE manuel avait ete fait
-- en SQL Editor pour debloquer le dashboard. Maintenant que le login admin
-- cree une vraie session (profiles.role='admin'), on peut re-activer
-- proprement sans rien casser.
--
-- Les policies de 002-rls.sql existent probablement encore (DISABLE ne les
-- supprime pas), mais on les recree par securite (DROP IF EXISTS + CREATE).
--
-- NOTE : les Edge Functions (sync-google-ads, sync-meta-ads, sync-prestashop)
-- utilisent la service_role key qui bypasse RLS — aucune action requise.
--
-- Run in Supabase SQL Editor. Idempotent.
-- =============================================

-- ============================================
-- 1. ENABLE RLS
-- ============================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_daily_metrics ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. CLIENTS policies
-- ============================================
DROP POLICY IF EXISTS "Admin/staff see all agency clients" ON clients;
CREATE POLICY "Admin/staff see all agency clients"
    ON clients FOR SELECT
    USING (
        agency_id = get_user_agency_id()
        AND get_user_role() IN ('admin', 'staff')
    );

DROP POLICY IF EXISTS "Client users see assigned clients" ON clients;
CREATE POLICY "Client users see assigned clients"
    ON clients FOR SELECT
    USING (
        get_user_role() = 'client'
        AND id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Admin can manage clients" ON clients;
CREATE POLICY "Admin can manage clients"
    ON clients FOR ALL
    USING (
        agency_id = get_user_agency_id()
        AND get_user_role() = 'admin'
    );

-- ============================================
-- 3. CLIENT_USERS policies
-- ============================================
DROP POLICY IF EXISTS "Admin can manage client_users" ON client_users;
CREATE POLICY "Admin can manage client_users"
    ON client_users FOR ALL
    USING (
        get_user_role() = 'admin'
        AND client_id IN (SELECT id FROM clients WHERE agency_id = get_user_agency_id())
    );

DROP POLICY IF EXISTS "Users see own assignments" ON client_users;
CREATE POLICY "Users see own assignments"
    ON client_users FOR SELECT
    USING (user_id = auth.uid());

-- ============================================
-- 4. INTEGRATIONS policies
-- ============================================
DROP POLICY IF EXISTS "Admin/staff see integrations" ON integrations;
CREATE POLICY "Admin/staff see integrations"
    ON integrations FOR SELECT
    USING (
        user_can_access_client(client_id)
        AND get_user_role() IN ('admin', 'staff')
    );

DROP POLICY IF EXISTS "Admin can manage integrations" ON integrations;
CREATE POLICY "Admin can manage integrations"
    ON integrations FOR ALL
    USING (
        user_can_access_client(client_id)
        AND get_user_role() = 'admin'
    );

-- ============================================
-- 5. AD_ACCOUNTS policies
-- ============================================
DROP POLICY IF EXISTS "Users see ad_accounts for accessible clients" ON ad_accounts;
CREATE POLICY "Users see ad_accounts for accessible clients"
    ON ad_accounts FOR SELECT
    USING (user_can_access_client(client_id));

DROP POLICY IF EXISTS "Admin/staff manage ad_accounts" ON ad_accounts;
CREATE POLICY "Admin/staff manage ad_accounts"
    ON ad_accounts FOR ALL
    USING (
        user_can_access_client(client_id)
        AND get_user_role() IN ('admin', 'staff')
    );

-- ============================================
-- 6. AD_CAMPAIGNS policies
-- ============================================
DROP POLICY IF EXISTS "Users see ad_campaigns" ON ad_campaigns;
CREATE POLICY "Users see ad_campaigns"
    ON ad_campaigns FOR SELECT
    USING (
        ad_account_id IN (SELECT id FROM ad_accounts WHERE user_can_access_client(client_id))
    );

DROP POLICY IF EXISTS "Admin/staff manage ad_campaigns" ON ad_campaigns;
CREATE POLICY "Admin/staff manage ad_campaigns"
    ON ad_campaigns FOR ALL
    USING (
        ad_account_id IN (SELECT id FROM ad_accounts WHERE user_can_access_client(client_id))
        AND get_user_role() IN ('admin', 'staff')
    );

-- ============================================
-- 7. AD_DAILY_METRICS policies
-- ============================================
DROP POLICY IF EXISTS "Users see ad_daily_metrics" ON ad_daily_metrics;
CREATE POLICY "Users see ad_daily_metrics"
    ON ad_daily_metrics FOR SELECT
    USING (
        campaign_id IN (
            SELECT ac.id FROM ad_campaigns ac
            JOIN ad_accounts aa ON ac.ad_account_id = aa.id
            WHERE user_can_access_client(aa.client_id)
        )
    );

DROP POLICY IF EXISTS "Admin/staff manage ad_daily_metrics" ON ad_daily_metrics;
CREATE POLICY "Admin/staff manage ad_daily_metrics"
    ON ad_daily_metrics FOR ALL
    USING (
        campaign_id IN (
            SELECT ac.id FROM ad_campaigns ac
            JOIN ad_accounts aa ON ac.ad_account_id = aa.id
            WHERE user_can_access_client(aa.client_id)
        )
        AND get_user_role() IN ('admin', 'staff')
    );

-- ============================================
-- VERIFICATION post-execution :
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname='public' AND rowsecurity = false
--   ORDER BY tablename;
--   → doit retourner 0 ligne
-- ============================================
