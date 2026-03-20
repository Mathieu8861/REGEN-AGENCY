-- ============================================
-- REGEN AGENCY - Triggers & Functions
-- Run AFTER 002-rls.sql in Supabase SQL Editor
-- ============================================

-- ============================================
-- Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'client')
    );
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'handle_new_user error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- Parse UTM from source_url on order insert/update
-- ============================================
CREATE OR REPLACE FUNCTION parse_utm_from_url()
RETURNS TRIGGER AS $$
DECLARE
    v_url TEXT;
    v_params TEXT;
    v_pairs TEXT[];
    v_pair TEXT[];
    v_key TEXT;
    v_value TEXT;
BEGIN
    v_url := NEW.source_url;

    IF v_url IS NULL OR v_url = '' THEN
        RETURN NEW;
    END IF;

    -- Extract query string
    IF position('?' in v_url) > 0 THEN
        v_params := substring(v_url from position('?' in v_url) + 1);
    ELSE
        RETURN NEW;
    END IF;

    -- Split by &
    v_pairs := string_to_array(v_params, '&');

    FOREACH v_key IN ARRAY v_pairs LOOP
        v_pair := string_to_array(v_key, '=');
        IF array_length(v_pair, 1) >= 2 THEN
            v_key := v_pair[1];
            v_value := v_pair[2];

            CASE v_key
                WHEN 'utm_source' THEN NEW.utm_source := v_value;
                WHEN 'utm_medium' THEN NEW.utm_medium := v_value;
                WHEN 'utm_campaign' THEN NEW.utm_campaign := v_value;
                WHEN 'utm_content' THEN NEW.utm_content := v_value;
                WHEN 'utm_id' THEN NEW.utm_id := v_value;
                WHEN 'gclid' THEN NEW.gclid := v_value;
                WHEN 'gad_campaignid' THEN NEW.gad_campaignid := v_value;
                WHEN 'fbclid' THEN NEW.fbclid := v_value;
                WHEN 'ttclid' THEN NEW.ttclid := v_value;
                ELSE NULL;
            END CASE;
        END IF;
    END LOOP;

    -- Auto-detect channel
    IF NEW.gclid IS NOT NULL OR (NEW.utm_source = 'google' AND NEW.utm_medium = 'cpc') THEN
        NEW.channel := 'google_ads';
    ELSIF NEW.fbclid IS NOT NULL OR NEW.utm_source IN ('facebook', 'meta', 'instagram', 'fb', 'ig') THEN
        NEW.channel := 'meta_ads';
    ELSIF NEW.ttclid IS NOT NULL OR NEW.utm_source = 'tiktok' THEN
        NEW.channel := 'tiktok_ads';
    ELSIF NEW.utm_medium = 'email' THEN
        NEW.channel := 'email';
    ELSIF NEW.utm_source IS NOT NULL THEN
        NEW.channel := 'referral';
    ELSE
        NEW.channel := 'direct';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_order_insert_parse_utm
    BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION parse_utm_from_url();

CREATE TRIGGER before_order_update_parse_utm
    BEFORE UPDATE OF source_url ON orders
    FOR EACH ROW EXECUTE FUNCTION parse_utm_from_url();

-- ============================================
-- RPC: Get dashboard stats for a client
-- ============================================
CREATE OR REPLACE FUNCTION get_dashboard_stats(
    p_client_id UUID,
    p_date_from DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
    p_date_to DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Check access
    IF NOT user_can_access_client(p_client_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    SELECT json_build_object(
        'total_revenue', COALESCE(SUM(total_ttc), 0),
        'total_orders', COUNT(*),
        'avg_basket', COALESCE(AVG(total_ttc), 0),
        'channels', (
            SELECT json_agg(ch)
            FROM (
                SELECT
                    channel,
                    COUNT(*) as orders_count,
                    SUM(total_ttc) as revenue,
                    AVG(total_ttc) as avg_basket
                FROM orders
                WHERE client_id = p_client_id
                    AND order_date BETWEEN p_date_from AND p_date_to
                GROUP BY channel
                ORDER BY SUM(total_ttc) DESC
            ) ch
        ),
        'daily', (
            SELECT json_agg(d ORDER BY d.date)
            FROM (
                SELECT
                    order_date as date,
                    COUNT(*) as orders_count,
                    SUM(total_ttc) as revenue
                FROM orders
                WHERE client_id = p_client_id
                    AND order_date BETWEEN p_date_from AND p_date_to
                GROUP BY order_date
            ) d
        )
    ) INTO v_result
    FROM orders
    WHERE client_id = p_client_id
        AND order_date BETWEEN p_date_from AND p_date_to;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Get campaign performance
-- ============================================
CREATE OR REPLACE FUNCTION get_campaign_stats(
    p_client_id UUID,
    p_date_from DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
    p_date_to DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    IF NOT user_can_access_client(p_client_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    SELECT json_agg(row_to_json(c))
    INTO v_result
    FROM (
        SELECT
            ac.id,
            ac.external_id,
            ac.name,
            ac.platform,
            ac.status,
            COALESCE(SUM(m.spend), 0) as total_spend,
            COALESCE(SUM(m.impressions), 0) as total_impressions,
            COALESCE(SUM(m.clicks), 0) as total_clicks,
            COALESCE(SUM(m.conversions), 0) as total_conversions,
            CASE WHEN SUM(m.clicks) > 0
                THEN ROUND(SUM(m.spend) / SUM(m.clicks), 2)
                ELSE 0 END as avg_cpc,
            CASE WHEN SUM(m.impressions) > 0
                THEN ROUND(SUM(m.clicks)::NUMERIC / SUM(m.impressions) * 100, 2)
                ELSE 0 END as avg_ctr
        FROM ad_campaigns ac
        JOIN ad_accounts aa ON ac.ad_account_id = aa.id
        LEFT JOIN ad_daily_metrics m ON m.campaign_id = ac.id
            AND m.date BETWEEN p_date_from AND p_date_to
        WHERE aa.client_id = p_client_id
        GROUP BY ac.id, ac.name, ac.platform, ac.status
        ORDER BY COALESCE(SUM(m.spend), 0) DESC
    ) c;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Get weekly spend summary (manual data)
-- ============================================
CREATE OR REPLACE FUNCTION get_weekly_summary(
    p_client_id UUID,
    p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
    p_month INTEGER DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    IF NOT user_can_access_client(p_client_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    SELECT json_agg(row_to_json(w))
    INTO v_result
    FROM (
        SELECT
            platform,
            week,
            spend,
            revenue,
            orders_count,
            CASE WHEN spend > 0
                THEN ROUND(revenue / spend, 2)
                ELSE 0 END as roas,
            CASE WHEN orders_count > 0
                THEN ROUND(revenue / orders_count, 2)
                ELSE 0 END as avg_basket
        FROM ad_weekly_spend
        WHERE client_id = p_client_id
            AND year = p_year
            AND (p_month IS NULL OR week BETWEEN (p_month - 1) * 4 + 1 AND p_month * 5)
        ORDER BY platform, week
    ) w;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Import orders from CSV data (batch insert)
-- ============================================
CREATE OR REPLACE FUNCTION import_orders_batch(
    p_client_id UUID,
    p_orders JSONB,
    p_source TEXT DEFAULT 'csv'
)
RETURNS JSON AS $$
DECLARE
    v_order JSONB;
    v_inserted INTEGER := 0;
    v_skipped INTEGER := 0;
    v_errors JSONB := '[]'::JSONB;
    v_log_id UUID;
BEGIN
    IF NOT user_can_access_client(p_client_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Create import log
    INSERT INTO import_logs (client_id, source, status, created_by)
    VALUES (p_client_id, p_source, 'processing', auth.uid())
    RETURNING id INTO v_log_id;

    FOR v_order IN SELECT * FROM jsonb_array_elements(p_orders)
    LOOP
        BEGIN
            INSERT INTO orders (
                client_id, external_id, reference, order_date, total_ttc,
                source_url, import_source
            ) VALUES (
                p_client_id,
                v_order->>'external_id',
                v_order->>'reference',
                (v_order->>'order_date')::DATE,
                (v_order->>'total_ttc')::NUMERIC,
                v_order->>'source_url',
                p_source
            )
            ON CONFLICT (client_id, external_id) DO NOTHING;

            IF FOUND THEN
                -- Insert order items if present
                IF v_order->'items' IS NOT NULL THEN
                    INSERT INTO order_items (order_id, product_name)
                    SELECT
                        (SELECT id FROM orders WHERE client_id = p_client_id AND external_id = v_order->>'external_id'),
                        item->>'name'
                    FROM jsonb_array_elements(v_order->'items') AS item;
                END IF;

                v_inserted := v_inserted + 1;
            ELSE
                v_skipped := v_skipped + 1;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors || jsonb_build_object(
                'external_id', v_order->>'external_id',
                'error', SQLERRM
            );
        END;
    END LOOP;

    -- Update import log
    UPDATE import_logs
    SET status = 'completed',
        rows_imported = v_inserted,
        rows_skipped = v_skipped,
        errors = v_errors
    WHERE id = v_log_id;

    RETURN json_build_object(
        'imported', v_inserted,
        'skipped', v_skipped,
        'errors', v_errors,
        'log_id', v_log_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
