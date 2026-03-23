// ============================================
// REGEN AGENCY - Sync Google Ads Campaigns
// Supabase Edge Function (Deno)
//
// Triggers:
//   - pg_cron (daily at 7 AM)
//   - Manual "Sync now" button from frontend
//
// Prerequisites (stored as Edge Function secrets):
//   - GOOGLE_ADS_CLIENT_ID
//   - GOOGLE_ADS_CLIENT_SECRET
//   - GOOGLE_ADS_REFRESH_TOKEN
//   - GOOGLE_ADS_DEVELOPER_TOKEN
//
// Flow:
//   1. Refresh OAuth access token
//   2. Read active Google Ads integrations
//   3. For each: fetch campaign metrics via GAQL
//   4. Upsert into ad_campaigns + ad_daily_metrics
//   5. Update integration status
// ============================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Google Ads API config (stored as secrets)
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_ADS_CLIENT_ID") || "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET") || "";
const GOOGLE_REFRESH_TOKEN = Deno.env.get("GOOGLE_ADS_REFRESH_TOKEN") || "";
const GOOGLE_DEVELOPER_TOKEN = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN") || "";

const GOOGLE_ADS_API_VERSION = "v17"; // Google Ads API latest stable

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Types ───────────────────────────────
interface Integration {
  id: string;
  client_id: string;
  credentials: {
    access_type: "mcc" | "direct";
    customer_id: string;
    mcc_id?: string;
  };
  last_sync: string | null;
}

interface CampaignMetric {
  campaign_id: string;
  campaign_name: string;
  campaign_status: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
}

// ── CORS headers ────────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Main Handler ────────────────────────
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const targetClientId = body.client_id || null;
    const trigger = body.trigger || "manual";

    console.log(`[sync-google-ads] Started. Trigger: ${trigger}, Client: ${targetClientId || "all"}`);

    // Check required secrets
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN || !GOOGLE_DEVELOPER_TOKEN) {
      return jsonResponse(
        {
          error: "Google Ads API credentials not configured. Set GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN, and GOOGLE_ADS_DEVELOPER_TOKEN as Edge Function secrets.",
        },
        400
      );
    }

    // 1. Refresh OAuth access token
    const accessToken = await refreshAccessToken();
    console.log("[sync-google-ads] Access token refreshed");

    // 2. Get active Google Ads integrations
    let query = supabase
      .from("integrations")
      .select("*")
      .eq("platform", "google_ads")
      .in("status", ["active", "pending"]);

    if (targetClientId) {
      query = query.eq("client_id", targetClientId);
    }

    const { data: integrations, error: intError } = await query;
    if (intError) throw intError;

    if (!integrations || integrations.length === 0) {
      return jsonResponse({ message: "No active Google Ads integrations found", synced: 0 });
    }

    const results: Array<{
      client_id: string;
      campaigns_synced: number;
      metrics_synced: number;
      errors: string[];
    }> = [];

    // 3. Process each integration
    for (const integration of integrations as Integration[]) {
      const result = await syncGoogleAdsAccount(integration, accessToken);
      results.push(result);

      // Small delay between accounts to avoid rate limits
      await new Promise((r) => setTimeout(r, 300));
    }

    const totalCampaigns = results.reduce((s, r) => s + r.campaigns_synced, 0);
    const totalMetrics = results.reduce((s, r) => s + r.metrics_synced, 0);

    console.log(`[sync-google-ads] Done. Campaigns: ${totalCampaigns}, Metrics: ${totalMetrics}`);

    return jsonResponse({
      message: "Sync completed",
      results,
      total_campaigns: totalCampaigns,
      total_metrics: totalMetrics,
    });
  } catch (err) {
    console.error("[sync-google-ads] Fatal error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});

// ── Refresh OAuth Access Token ──────────
async function refreshAccessToken(): Promise<string> {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OAuth token refresh failed: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

// ── Sync One Google Ads Account ─────────
async function syncGoogleAdsAccount(
  integration: Integration,
  accessToken: string
) {
  const { client_id, credentials, id: integrationId } = integration;
  const { customer_id, mcc_id, access_type } = credentials;

  const result = {
    client_id,
    campaigns_synced: 0,
    metrics_synced: 0,
    errors: [] as string[],
  };

  // Clean customer ID (remove hyphens)
  const customerId = customer_id.replace(/-/g, "");
  const mccId = mcc_id ? mcc_id.replace(/-/g, "") : "";

  // Date range: last 7 days (to capture retroactive conversions)
  const dateTo = new Date(Date.now() - 86400000); // Yesterday
  const dateFrom = new Date(dateTo.getTime() - 7 * 86400000); // 7 days before yesterday
  const dateToStr = dateTo.toISOString().split("T")[0];
  const dateFromStr = dateFrom.toISOString().split("T")[0];

  console.log(`[sync-google-ads] Syncing customer ${customer_id} from ${dateFromStr} to ${dateToStr}`);

  try {
    // First, ensure we have an ad_account record
    const { data: adAccount } = await supabase
      .from("ad_accounts")
      .upsert(
        {
          client_id,
          integration_id: integrationId,
          external_id: customerId,
          name: `Google Ads ${customer_id}`,
          platform: "google_ads",
          currency: "EUR",
        },
        { onConflict: "client_id,external_id" }
      )
      .select("id")
      .single();

    if (!adAccount) {
      result.errors.push("Failed to create/find ad_account");
      return result;
    }

    // GAQL Query for campaign metrics by day
    const gaqlQuery = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        segments.date,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.average_cpc,
        metrics.conversions,
        metrics.cost_per_conversion,
        metrics.conversions_from_interactions_rate
      FROM campaign
      WHERE segments.date BETWEEN '${dateFromStr}' AND '${dateToStr}'
        AND campaign.status != 'REMOVED'
      ORDER BY segments.date DESC, metrics.cost_micros DESC
    `;

    // Build headers
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": GOOGLE_DEVELOPER_TOKEN,
      "Content-Type": "application/json",
    };

    // Add MCC header if using MCC access
    if (access_type === "mcc" && mccId) {
      headers["login-customer-id"] = mccId;
    }

    // Execute GAQL query
    const apiUrl = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:search`;

    let allRows: CampaignMetric[] = [];
    let pageToken: string | null = null;

    do {
      const requestBody: Record<string, unknown> = {
        query: gaqlQuery,
        pageSize: 10000,
      };
      if (pageToken) {
        requestBody.pageToken = pageToken;
      }

      const response = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Ads API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const results_rows = data.results || [];

      // Parse rows
      for (const row of results_rows) {
        allRows.push({
          campaign_id: row.campaign?.id || "",
          campaign_name: row.campaign?.name || "",
          campaign_status: (row.campaign?.status || "UNKNOWN").toLowerCase(),
          date: row.segments?.date || "",
          spend: (parseInt(row.metrics?.costMicros || "0") / 1_000_000),
          impressions: parseInt(row.metrics?.impressions || "0"),
          clicks: parseInt(row.metrics?.clicks || "0"),
          ctr: parseFloat(row.metrics?.ctr || "0") * 100, // Convert to percentage
          cpc: (parseInt(row.metrics?.averageCpc || "0") / 1_000_000),
          conversions: parseFloat(row.metrics?.conversions || "0"),
        });
      }

      pageToken = data.nextPageToken || null;
    } while (pageToken);

    console.log(`[sync-google-ads] Fetched ${allRows.length} campaign-date rows`);

    // Get unique campaigns
    const campaignMap = new Map<string, { name: string; status: string }>();
    for (const row of allRows) {
      if (!campaignMap.has(row.campaign_id)) {
        campaignMap.set(row.campaign_id, {
          name: row.campaign_name,
          status: row.campaign_status,
        });
      }
    }

    // Upsert campaigns
    for (const [extId, campaign] of campaignMap) {
      const { error } = await supabase.from("ad_campaigns").upsert(
        {
          ad_account_id: adAccount.id,
          external_id: extId,
          name: campaign.name,
          status: campaign.status,
          campaign_type: "unknown", // GAQL doesn't return this in our query
          platform: "google_ads",
        },
        { onConflict: "ad_account_id,external_id" }
      );

      if (error) {
        result.errors.push(`Campaign ${extId}: ${error.message}`);
      } else {
        result.campaigns_synced++;
      }
    }

    // Upsert daily metrics
    for (const row of allRows) {
      // Find the campaign ID in our DB
      const { data: campaignRow } = await supabase
        .from("ad_campaigns")
        .select("id")
        .eq("ad_account_id", adAccount.id)
        .eq("external_id", row.campaign_id)
        .single();

      if (!campaignRow) continue;

      const { error } = await supabase.from("ad_daily_metrics").upsert(
        {
          campaign_id: campaignRow.id,
          date: row.date,
          spend: row.spend,
          impressions: row.impressions,
          clicks: row.clicks,
          conversions: row.conversions,
          revenue_reported: 0, // Google Ads doesn't always report revenue
          cpc: row.cpc,
          cpm: row.impressions > 0 ? (row.spend / row.impressions) * 1000 : 0,
          ctr: row.ctr,
        },
        { onConflict: "campaign_id,date" }
      );

      if (error) {
        result.errors.push(`Metric ${row.campaign_id}/${row.date}: ${error.message}`);
      } else {
        result.metrics_synced++;
      }
    }

    // Update integration
    await supabase
      .from("integrations")
      .update({
        last_sync: new Date().toISOString(),
        status: "active",
        config: {
          last_sync_result: {
            campaigns: result.campaigns_synced,
            metrics: result.metrics_synced,
            errors: result.errors.length,
            date_range: `${dateFromStr} - ${dateToStr}`,
            timestamp: new Date().toISOString(),
          },
        },
      })
      .eq("id", integrationId);
  } catch (err) {
    console.error(`[sync-google-ads] Error syncing ${customer_id}:`, err);
    result.errors.push((err as Error).message);

    await supabase
      .from("integrations")
      .update({
        status: "error",
        config: { last_error: (err as Error).message, timestamp: new Date().toISOString() },
      })
      .eq("id", integrationId);
  }

  return result;
}

// ── Helpers ─────────────────────────────
function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}
