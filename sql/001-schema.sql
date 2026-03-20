-- ============================================
-- REGEN AGENCY - Espace Client Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. AGENCIES
-- ============================================
CREATE TABLE agencies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. CLIENTS (entreprises gerees par l'agence)
-- ============================================
CREATE TABLE clients (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    logo_url TEXT,
    website TEXT,
    platform TEXT CHECK (platform IN ('prestashop', 'shopify', 'woocommerce', 'other')),
    color TEXT DEFAULT '#2FB963',
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clients_agency ON clients(agency_id);

-- ============================================
-- 3. PROFILES (extends auth.users)
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'client')) DEFAULT 'client',
    agency_id UUID REFERENCES agencies(id),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. CLIENT_USERS (which users can see which clients)
-- ============================================
CREATE TABLE client_users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, user_id)
);

CREATE INDEX idx_client_users_user ON client_users(user_id);
CREATE INDEX idx_client_users_client ON client_users(client_id);

-- ============================================
-- 5. INTEGRATIONS (connexions API par client)
-- ============================================
CREATE TABLE integrations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN (
        'google_ads', 'meta_ads', 'tiktok_ads',
        'prestashop', 'shopify', 'woocommerce',
        'google_analytics'
    )),
    credentials JSONB DEFAULT '{}',
    config JSONB DEFAULT '{}',
    status TEXT DEFAULT 'pending' CHECK (status IN ('active', 'error', 'pending', 'disconnected')),
    last_sync TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_integrations_client ON integrations(client_id);

-- ============================================
-- 6. ORDERS (commandes normalisees)
-- ============================================
CREATE TABLE orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    external_id TEXT,
    reference TEXT,
    order_date DATE NOT NULL,
    total_ttc NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'EUR',
    source_url TEXT,
    channel TEXT CHECK (channel IN (
        'google_ads', 'meta_ads', 'tiktok_ads',
        'email', 'organic', 'direct', 'referral', 'other'
    )),
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_id TEXT,
    gclid TEXT,
    gad_campaignid TEXT,
    fbclid TEXT,
    ttclid TEXT,
    import_source TEXT CHECK (import_source IN ('csv', 'api_prestashop', 'api_shopify', 'api_woo', 'manual')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, external_id)
);

CREATE INDEX idx_orders_client ON orders(client_id);
CREATE INDEX idx_orders_date ON orders(order_date);
CREATE INDEX idx_orders_channel ON orders(channel);
CREATE INDEX idx_orders_client_date ON orders(client_id, order_date);

-- ============================================
-- 7. ORDER_ITEMS (produits par commande)
-- ============================================
CREATE TABLE order_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price NUMERIC(10,2) DEFAULT 0
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ============================================
-- 8. AD_ACCOUNTS (comptes publicitaires)
-- ============================================
CREATE TABLE ad_accounts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    integration_id UUID REFERENCES integrations(id) ON DELETE SET NULL,
    external_id TEXT NOT NULL,
    name TEXT,
    platform TEXT NOT NULL CHECK (platform IN ('google_ads', 'meta_ads', 'tiktok_ads')),
    currency TEXT DEFAULT 'EUR',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ad_accounts_client ON ad_accounts(client_id);
ALTER TABLE ad_accounts ADD CONSTRAINT ad_accounts_client_external_unique UNIQUE (client_id, external_id);

-- ============================================
-- 9. AD_CAMPAIGNS
-- ============================================
CREATE TABLE ad_campaigns (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    ad_account_id UUID NOT NULL REFERENCES ad_accounts(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'unknown',
    campaign_type TEXT,
    platform TEXT NOT NULL CHECK (platform IN ('google_ads', 'meta_ads', 'tiktok_ads')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ad_campaigns_account ON ad_campaigns(ad_account_id);
CREATE INDEX idx_ad_campaigns_external ON ad_campaigns(external_id);
ALTER TABLE ad_campaigns ADD CONSTRAINT ad_campaigns_account_external_unique UNIQUE (ad_account_id, external_id);

-- ============================================
-- 10. AD_DAILY_METRICS
-- ============================================
CREATE TABLE ad_daily_metrics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    spend NUMERIC(10,2) DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions NUMERIC(10,2) DEFAULT 0,
    revenue_reported NUMERIC(12,2) DEFAULT 0,
    cpc NUMERIC(8,4) DEFAULT 0,
    cpm NUMERIC(8,4) DEFAULT 0,
    ctr NUMERIC(8,4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, date)
);

CREATE INDEX idx_ad_metrics_campaign_date ON ad_daily_metrics(campaign_id, date);

-- ============================================
-- 11. AD_WEEKLY_SPEND (saisie manuelle hebdo)
-- Pour la transition depuis Google Sheets
-- ============================================
CREATE TABLE ad_weekly_spend (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('google_ads', 'meta_ads', 'tiktok_ads', 'other')),
    year INTEGER NOT NULL,
    week INTEGER NOT NULL CHECK (week BETWEEN 1 AND 53),
    spend NUMERIC(10,2) NOT NULL DEFAULT 0,
    revenue NUMERIC(12,2) DEFAULT 0,
    orders_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, platform, year, week)
);

CREATE INDEX idx_weekly_spend_client ON ad_weekly_spend(client_id);

-- ============================================
-- 12. DAILY_KPIS (precalcules pour performance)
-- ============================================
CREATE TABLE daily_kpis (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    channel TEXT,
    ad_spend NUMERIC(10,2) DEFAULT 0,
    revenue NUMERIC(12,2) DEFAULT 0,
    orders_count INTEGER DEFAULT 0,
    avg_basket NUMERIC(10,2) DEFAULT 0,
    roas NUMERIC(8,2) DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    cpc NUMERIC(8,4) DEFAULT 0,
    ctr NUMERIC(8,4) DEFAULT 0,
    conversion_rate NUMERIC(8,4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, date, channel)
);

CREATE INDEX idx_daily_kpis_client_date ON daily_kpis(client_id, date);

-- ============================================
-- 13. MONTHLY_KPIS
-- ============================================
CREATE TABLE monthly_kpis (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    channel TEXT,
    ad_spend NUMERIC(10,2) DEFAULT 0,
    revenue NUMERIC(12,2) DEFAULT 0,
    orders_count INTEGER DEFAULT 0,
    avg_basket NUMERIC(10,2) DEFAULT 0,
    roas NUMERIC(8,2) DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, year, month, channel)
);

CREATE INDEX idx_monthly_kpis_client ON monthly_kpis(client_id, year, month);

-- ============================================
-- 14. REPORTS (documents et rapports)
-- ============================================
CREATE TABLE reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT DEFAULT 'monthly' CHECK (type IN ('monthly', 'weekly', 'custom', 'invoice')),
    period_start DATE,
    period_end DATE,
    file_url TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_client ON reports(client_id);

-- ============================================
-- 15. IMPORT_LOGS
-- ============================================
CREATE TABLE import_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    rows_imported INTEGER DEFAULT 0,
    rows_skipped INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]',
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_import_logs_client ON import_logs(client_id);
