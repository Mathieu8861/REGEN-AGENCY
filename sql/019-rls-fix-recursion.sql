-- =============================================
-- 019-rls-fix-recursion.sql
-- Casse la recursion circulaire entre les policies clients <-> client_users.
--
-- LE BUG :
--   - policy "Client users see assigned clients" (sur clients) fait un
--     sous-SELECT direct sur client_users
--   - policy "Admin can manage client_users" (sur client_users) fait un
--     sous-SELECT direct sur clients
--   → PostgreSQL detecte un cycle ("infinite recursion detected in policy")
--     et rejette TOUTES les requetes sur ces 2 tables, pour tous les roles
--     (les policies permissives sont evaluees en OR, donc meme l'admin est
--     bloque par l'evaluation de la policy client).
--
-- C'est tres probablement la cause originelle du bug "donnees fantomes"
-- d'avril, que le DISABLE ROW LEVEL SECURITY masquait.
--
-- LE FIX :
--   Remplacer les sous-SELECT directs par la fonction user_can_access_client()
--   qui est SECURITY DEFINER : elle lit profiles/clients/client_users en
--   bypassant leurs policies → plus de cycle.
--
-- Run AFTER 018-rls-reenable.sql in Supabase SQL Editor. Idempotent.
-- =============================================

-- ============================================
-- 1. CLIENTS : recreer la policy "client" sans sous-select direct
-- ============================================
DROP POLICY IF EXISTS "Client users see assigned clients" ON clients;
CREATE POLICY "Client users see assigned clients"
    ON clients FOR SELECT
    USING (
        get_user_role() = 'client'
        AND user_can_access_client(id)
    );

-- Les 2 autres policies de clients ne sont pas recursives
-- (elles n'utilisent que get_user_agency_id() / get_user_role(),
-- des fonctions SECURITY DEFINER) → on les garde telles quelles.

-- ============================================
-- 2. CLIENT_USERS : recreer la policy admin sans sous-select direct
-- ============================================
DROP POLICY IF EXISTS "Admin can manage client_users" ON client_users;
CREATE POLICY "Admin can manage client_users"
    ON client_users FOR ALL
    USING (
        get_user_role() = 'admin'
        AND user_can_access_client(client_id)
    )
    WITH CHECK (
        get_user_role() = 'admin'
        AND user_can_access_client(client_id)
    );

-- "Users see own assignments" (user_id = auth.uid()) n'est pas recursive → on garde.

-- ============================================
-- 3. Hardening des fonctions helpers (bonne pratique Supabase) :
--    fixer le search_path pour eviter tout hijack + s'assurer qu'elles
--    sont bien SECURITY DEFINER.
-- ============================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION get_user_agency_id()
RETURNS UUID AS $$
    SELECT agency_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION user_can_access_client(p_client_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_role TEXT;
    v_agency_id UUID;
BEGIN
    SELECT role, agency_id INTO v_role, v_agency_id FROM public.profiles WHERE id = auth.uid();

    IF v_role IN ('admin', 'staff') THEN
        RETURN EXISTS (SELECT 1 FROM public.clients WHERE id = p_client_id AND agency_id = v_agency_id);
    ELSE
        RETURN EXISTS (SELECT 1 FROM public.client_users WHERE client_id = p_client_id AND user_id = auth.uid());
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- ============================================
-- VERIFICATION post-execution (3 queries) :
--
-- a) Plus de table sans RLS :
--    SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity=false;
--    → 0 ligne
--
-- b) Policies en place :
--    SELECT tablename, policyname FROM pg_policies
--    WHERE tablename IN ('clients','client_users') ORDER BY 1,2;
--    → 5 policies (3 clients + 2 client_users)
--
-- c) Teste dans l'admin (hard refresh + reconnexion) :
--    le dashboard doit reafficher les 8 clients.
-- ============================================
