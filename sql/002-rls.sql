-- ============================================
-- REGEN AGENCY - Row Level Security Policies
-- Run AFTER 001-schema.sql in Supabase SQL Editor
-- ============================================

-- Enable RLS on all tables
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_weekly_spend ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Helper function : get current user's role
-- ============================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- Helper function : get current user's agency
-- ============================================
CREATE OR REPLACE FUNCTION get_user_agency_id()
RETURNS UUID AS $$
    SELECT agency_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- Helper function : get client IDs accessible by current user
-- ============================================
CREATE OR REPLACE FUNCTION get_accessible_client_ids()
RETURNS SETOF UUID AS $$
    SELECT CASE
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'staff')
        THEN (SELECT id FROM clients WHERE agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid()))
        ELSE (SELECT client_id FROM client_users WHERE user_id = auth.uid())
    END;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Simpler version for policies
CREATE OR REPLACE FUNCTION user_can_access_client(p_client_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_role TEXT;
    v_agency_id UUID;
BEGIN
    SELECT role, agency_id INTO v_role, v_agency_id FROM profiles WHERE id = auth.uid();

    IF v_role IN ('admin', 'staff') THEN
        RETURN EXISTS (SELECT 1 FROM clients WHERE id = p_client_id AND agency_id = v_agency_id);
    ELSE
        RETURN EXISTS (SELECT 1 FROM client_users WHERE client_id = p_client_id AND user_id = auth.uid());
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- PROFILES policies
-- ============================================
CREATE POLICY "Users can read own profile"
    ON profiles FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Admin/staff can read all profiles in agency"
    ON profiles FOR SELECT
    USING (
        agency_id = get_user_agency_id()
        AND get_user_role() IN ('admin', 'staff')
    );

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (id = auth.uid());

CREATE POLICY "Admin can manage profiles"
    ON profiles FOR ALL
    USING (get_user_role() = 'admin');

-- ============================================
-- AGENCIES policies
-- ============================================
CREATE POLICY "Users can read own agency"
    ON agencies FOR SELECT
    USING (id = get_user_agency_id());

-- ============================================
-- CLIENTS policies
-- ============================================
CREATE POLICY "Admin/staff see all agency clients"
    ON clients FOR SELECT
    USING (
        agency_id = get_user_agency_id()
        AND get_user_role() IN ('admin', 'staff')
    );

CREATE POLICY "Client users see assigned clients"
    ON clients FOR SELECT
    USING (
        get_user_role() = 'client'
        AND id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid())
    );

CREATE POLICY "Admin can manage clients"
    ON clients FOR ALL
    USING (
        agency_id = get_user_agency_id()
        AND get_user_role() = 'admin'
    );

-- ============================================
-- CLIENT_USERS policies
-- ============================================
CREATE POLICY "Admin can manage client_users"
    ON client_users FOR ALL
    USING (
        get_user_role() = 'admin'
        AND client_id IN (SELECT id FROM clients WHERE agency_id = get_user_agency_id())
    );

CREATE POLICY "Users see own assignments"
    ON client_users FOR SELECT
    USING (user_id = auth.uid());

-- ============================================
-- ORDERS policies (data tables - filter by client access)
-- ============================================
CREATE POLICY "Users see orders for accessible clients"
    ON orders FOR SELECT
    USING (user_can_access_client(client_id));

CREATE POLICY "Admin/staff can insert orders"
    ON orders FOR INSERT
    WITH CHECK (
        user_can_access_client(client_id)
        AND get_user_role() IN ('admin', 'staff')
    );

CREATE POLICY "Admin/staff can update orders"
    ON orders FOR UPDATE
    USING (
        user_can_access_client(client_id)
        AND get_user_role() IN ('admin', 'staff')
    );

CREATE POLICY "Admin can delete orders"
    ON orders FOR DELETE
    USING (
        user_can_access_client(client_id)
        AND get_user_role() = 'admin'
    );

-- ============================================
-- ORDER_ITEMS policies
-- ============================================
CREATE POLICY "Users see order_items for accessible orders"
    ON order_items FOR SELECT
    USING (
        order_id IN (SELECT id FROM orders WHERE user_can_access_client(client_id))
    );

CREATE POLICY "Admin/staff can manage order_items"
    ON order_items FOR ALL
    USING (
        order_id IN (
            SELECT id FROM orders
            WHERE user_can_access_client(client_id)
        )
        AND get_user_role() IN ('admin', 'staff')
    );

-- ============================================
-- INTEGRATIONS policies
-- ============================================
CREATE POLICY "Admin/staff see integrations"
    ON integrations FOR SELECT
    USING (
        user_can_access_client(client_id)
        AND get_user_role() IN ('admin', 'staff')
    );

CREATE POLICY "Admin can manage integrations"
    ON integrations FOR ALL
    USING (
        user_can_access_client(client_id)
        AND get_user_role() = 'admin'
    );

-- ============================================
-- AD data policies (ad_accounts, ad_campaigns, ad_daily_metrics)
-- ============================================
CREATE POLICY "Users see ad_accounts for accessible clients"
    ON ad_accounts FOR SELECT
    USING (user_can_access_client(client_id));

CREATE POLICY "Admin/staff manage ad_accounts"
    ON ad_accounts FOR ALL
    USING (
        user_can_access_client(client_id)
        AND get_user_role() IN ('admin', 'staff')
    );

CREATE POLICY "Users see ad_campaigns"
    ON ad_campaigns FOR SELECT
    USING (
        ad_account_id IN (SELECT id FROM ad_accounts WHERE user_can_access_client(client_id))
    );

CREATE POLICY "Admin/staff manage ad_campaigns"
    ON ad_campaigns FOR ALL
    USING (
        ad_account_id IN (SELECT id FROM ad_accounts WHERE user_can_access_client(client_id))
        AND get_user_role() IN ('admin', 'staff')
    );

CREATE POLICY "Users see ad_daily_metrics"
    ON ad_daily_metrics FOR SELECT
    USING (
        campaign_id IN (
            SELECT ac.id FROM ad_campaigns ac
            JOIN ad_accounts aa ON ac.ad_account_id = aa.id
            WHERE user_can_access_client(aa.client_id)
        )
    );

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
-- AD_WEEKLY_SPEND policies
-- ============================================
CREATE POLICY "Users see weekly spend for accessible clients"
    ON ad_weekly_spend FOR SELECT
    USING (user_can_access_client(client_id));

CREATE POLICY "Admin/staff manage weekly spend"
    ON ad_weekly_spend FOR ALL
    USING (
        user_can_access_client(client_id)
        AND get_user_role() IN ('admin', 'staff')
    );

-- ============================================
-- KPI policies
-- ============================================
CREATE POLICY "Users see daily_kpis"
    ON daily_kpis FOR SELECT
    USING (user_can_access_client(client_id));

CREATE POLICY "Admin/staff manage daily_kpis"
    ON daily_kpis FOR ALL
    USING (
        user_can_access_client(client_id)
        AND get_user_role() IN ('admin', 'staff')
    );

CREATE POLICY "Users see monthly_kpis"
    ON monthly_kpis FOR SELECT
    USING (user_can_access_client(client_id));

CREATE POLICY "Admin/staff manage monthly_kpis"
    ON monthly_kpis FOR ALL
    USING (
        user_can_access_client(client_id)
        AND get_user_role() IN ('admin', 'staff')
    );

-- ============================================
-- REPORTS policies
-- ============================================
CREATE POLICY "Users see reports for accessible clients"
    ON reports FOR SELECT
    USING (user_can_access_client(client_id));

CREATE POLICY "Admin/staff manage reports"
    ON reports FOR ALL
    USING (
        user_can_access_client(client_id)
        AND get_user_role() IN ('admin', 'staff')
    );

-- ============================================
-- IMPORT_LOGS policies
-- ============================================
CREATE POLICY "Admin/staff see import logs"
    ON import_logs FOR SELECT
    USING (
        user_can_access_client(client_id)
        AND get_user_role() IN ('admin', 'staff')
    );

CREATE POLICY "Admin/staff manage import logs"
    ON import_logs FOR ALL
    USING (
        user_can_access_client(client_id)
        AND get_user_role() IN ('admin', 'staff')
    );
