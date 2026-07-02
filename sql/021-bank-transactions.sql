-- ============================================
-- 021-bank-transactions.sql
-- Transactions bancaires (releves Swan) — module Compta > Releves
-- Idempotent : reexecutable sans risque.
-- A lancer dans le SQL Editor de Supabase.
-- ============================================

CREATE TABLE IF NOT EXISTS bank_transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id       UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    tx_date         DATE NOT NULL,
    tx_time         TEXT,                              -- 'HH:MM' (optionnel)
    label           TEXT NOT NULL,                     -- libelle brut du releve
    tx_type         TEXT,                              -- CarteEnLigne / Prelevement / Virement / Frais ...
    direction       TEXT NOT NULL CHECK (direction IN ('debit','credit')),
    amount          NUMERIC(12,2) NOT NULL,            -- valeur absolue (positive)
    category        TEXT,                              -- categorie (auto ou corrigee manuellement)
    poste           TEXT,                              -- poste / marchand normalise
    statement_month TEXT,                              -- 'YYYY-MM' pour regroupement rapide
    source_file     TEXT,                              -- nom du fichier importe
    dedup_hash      TEXT NOT NULL,                     -- cle anti-doublon (date|sens|montant|libelle|occurrence)
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Anti-doublon : une meme transaction n'entre qu'une fois (reimport du meme releve = sans effet)
CREATE UNIQUE INDEX IF NOT EXISTS bank_tx_dedup_idx ON bank_transactions (agency_id, dedup_hash);
CREATE INDEX IF NOT EXISTS bank_tx_date_idx  ON bank_transactions (agency_id, tx_date);
CREATE INDEX IF NOT EXISTS bank_tx_month_idx ON bank_transactions (agency_id, statement_month);
CREATE INDEX IF NOT EXISTS bank_tx_cat_idx   ON bank_transactions (agency_id, category);

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

-- Acces reserve admin/staff (comme les autres tables sensibles ; s'appuie sur get_user_role())
DROP POLICY IF EXISTS "Admin manage bank_transactions" ON bank_transactions;
CREATE POLICY "Admin manage bank_transactions"
    ON bank_transactions FOR ALL
    USING (get_user_role() IN ('admin','staff'))
    WITH CHECK (get_user_role() IN ('admin','staff'));
