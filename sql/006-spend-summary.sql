-- ============================================
-- REGEN AGENCY - Ad Spend Summary RPC
-- Run AFTER 003-triggers.sql in Supabase SQL Editor
-- ============================================

-- ============================================
-- RPC: Get aggregated ad spend from ad_daily_metrics
-- grouped by platform for a date range
-- Used by the dashboard to merge API spend data
-- with manual ad_weekly_spend entries
-- ============================================
CREATE OR REPLACE FUNCTION get_ad_spend_by_platform(
    p_client_id UUID,
    p_date_from DATE,
    p_date_to DATE
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    IF NOT user_can_access_client(p_client_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    SELECT json_agg(row_to_json(r))
    INTO v_result
    FROM (
        SELECT
            a.platform,
            SUM(m.spend) as total_spend,
            SUM(m.clicks) as total_clicks,
            SUM(m.impressions) as total_impressions,
            SUM(m.conversions) as total_conversions
        FROM ad_daily_metrics m
        JOIN ad_campaigns c ON m.campaign_id = c.id
        JOIN ad_accounts a ON c.ad_account_id = a.id
        WHERE a.client_id = p_client_id
          AND m.date BETWEEN p_date_from AND p_date_to
        GROUP BY a.platform
    ) r;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
