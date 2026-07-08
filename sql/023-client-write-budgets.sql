-- =============================================
-- 023-client-write-budgets.sql
-- Le CLIENT devient acteur du module Budget & Planning :
--   - il peut ecrire le budget PREVISIONNEL de ses marques (jamais is_actual,
--     qui vient de la sync Google/Meta)
--   - il peut creer / editer / supprimer les promos de ses marques
--   - il peut uploader / supprimer des visuels dans SON dossier du bucket
-- L'admin/staff garde tous ses droits (policies 014/016 inchangees pour lui).
-- Run AFTER 014 + 016. Idempotent.
-- =============================================

-- ============================================
-- 1. CLIENT_BUDGETS — ecriture client sur le previsionnel uniquement
-- ============================================
DROP POLICY IF EXISTS "Client insert own budgets previsionnel" ON client_budgets;
CREATE POLICY "Client insert own budgets previsionnel"
    ON client_budgets FOR INSERT
    TO authenticated
    WITH CHECK (user_can_access_client(client_id) AND is_actual = false);

DROP POLICY IF EXISTS "Client update own budgets previsionnel" ON client_budgets;
CREATE POLICY "Client update own budgets previsionnel"
    ON client_budgets FOR UPDATE
    TO authenticated
    USING (user_can_access_client(client_id) AND is_actual = false)
    WITH CHECK (user_can_access_client(client_id) AND is_actual = false);

DROP POLICY IF EXISTS "Client delete own budgets previsionnel" ON client_budgets;
CREATE POLICY "Client delete own budgets previsionnel"
    ON client_budgets FOR DELETE
    TO authenticated
    USING (user_can_access_client(client_id) AND is_actual = false);

-- ============================================
-- 2. CLIENT_PROMOS — ecriture client sur ses marques
-- ============================================
DROP POLICY IF EXISTS "Client insert own promos" ON client_promos;
CREATE POLICY "Client insert own promos"
    ON client_promos FOR INSERT
    TO authenticated
    WITH CHECK (user_can_access_client(client_id));

DROP POLICY IF EXISTS "Client update own promos" ON client_promos;
CREATE POLICY "Client update own promos"
    ON client_promos FOR UPDATE
    TO authenticated
    USING (user_can_access_client(client_id))
    WITH CHECK (user_can_access_client(client_id));

DROP POLICY IF EXISTS "Client delete own promos" ON client_promos;
CREATE POLICY "Client delete own promos"
    ON client_promos FOR DELETE
    TO authenticated
    USING (user_can_access_client(client_id));

-- ============================================
-- 3. STORAGE promo-visuals — upload/suppression via l'acces client
--    Le chemin des objets est "{client_id}/{fichier}" : on autorise si
--    l'utilisateur a acces au client du dossier (admin/staff restent couverts).
--    CASE = garantit qu'on ne caste en uuid que si le dossier a le bon format.
-- ============================================
DROP POLICY IF EXISTS "Admin/staff can upload promo visuals" ON storage.objects;
DROP POLICY IF EXISTS "Upload promo visuals via access" ON storage.objects;
CREATE POLICY "Upload promo visuals via access"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'promo-visuals'
        AND (
            get_user_role() IN ('admin', 'staff')
            OR (CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                     THEN user_can_access_client(((storage.foldername(name))[1])::uuid)
                     ELSE false END)
        )
    );

DROP POLICY IF EXISTS "Admin/staff can delete promo visuals" ON storage.objects;
DROP POLICY IF EXISTS "Delete promo visuals via access" ON storage.objects;
CREATE POLICY "Delete promo visuals via access"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'promo-visuals'
        AND (
            get_user_role() IN ('admin', 'staff')
            OR (CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                     THEN user_can_access_client(((storage.foldername(name))[1])::uuid)
                     ELSE false END)
        )
    );

-- Verification post-execution :
--   SELECT policyname, cmd FROM pg_policies WHERE tablename IN ('client_budgets','client_promos');
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'objects' AND policyname ILIKE '%promo%';
