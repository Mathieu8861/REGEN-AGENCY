// ============================================
// REGEN AGENCY - Sync Meta Ads Campaigns
// Supabase Edge Function (Deno)
//
// Triggers:
//   - pg_cron (daily at 7 AM)
//   - Manual "Sync now" button from frontend
//
// Prerequisites (stored as Edge Function secrets):
//   - META_ACCESS_TOKEN (long-lived user or system token)
//
// Flow:
//   1. Read active Meta Ads integrations from DB
//   2. For each: fetch campaigns + insights via Graph API
//   3. Upsert into ad_campaigns + ad_daily_metrics
//   4. Update integration status
// ============================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN") || "";

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Types ───────────────────────────────
interface Integration {
  id: string;
  client_id: string;
  credentials: {
    ad_account_id: string; // Format: act_XXXXXXXXX
  };
  last_sync: string | null;
}

interface CampaignInsight {
  campaign_id: string;
  campaign_name: string;
  status: string;
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const targetClientId = body.client_id || null;
    const trigger = body.trigger || "manual";

    console.log(`[sync-meta-ads] Started. Trigger: ${trigger}, Client: ${targetClientId || "all"}`);

    if (!META_ACCESS_TOKEN) {
      return jsonResponse(
        {
          error:
            "Meta Ads API credentials not configured. Set META_ACCESS_TOKEN as an Edge Function secret.",
        },
        400
      );
    }

    // Get active Meta Ads integrations
    let query = supabase
      .from("integrations")
      .select("*")
      .eq("platform", "meta_ads")
      .in("status", ["active", "pending"]);

    if (targetClientId) {
      query = query.eq("client_id", targetClientId);
    }

    const { data: integrations, error: intError } = await query;
    if (intError) throw intError;

    if (!integrations || integrations.length === 0) {
      return jsonResponse({
        message: "No active Meta Ads integrations found",
        synced: 0,
      });
    }

    const results: Array<{
      client_id: string;
      campaigns_synced: number;
      metrics_synced: number;
      errors: string[];
    }> = [];

    for (const integration of integrations as Integration[]) {
      const result = await syncMetaAdsAccount(integration);
      results.push(result);
      await new Promise((r) => setTimeout(r, 500));
    }

    const totalCampaigns = results.reduce((s, r) => s + r.campaigns_synced, 0);
    const totalMetrics = results.reduce((s, r) => s + r.metrics_synced, 0);

    console.log(
      `[sync-meta-ads] Done. Campaigns: ${totalCampaigns}, Metrics: ${totalMetrics}`
    );

    return jsonResponse({
      message: "Sync completed",
      results,
      total_campaigns: totalCampaigns,
      total_metrics: totalMetrics,
    });
  } catch (err) {
    console.error("[sync-meta-ads] Fatal error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});

// ── Sync One Meta Ads Account ───────────
async function syncMetaAdsAccount(integration: Integration) {
  const { client_id, credentials, id: integrationId } = integration;
  const adAccountId = credentials.ad_account_id; // act_XXXXXXXXX

  const result = {
    client_id,
    campaigns_synced: 0,
    metrics_synced: 0,
    errors: [] as string[],
  };

  // Date range: last 7 days
  const dateTo = new Date(Date.now() - 86400000);
  const dateFrom = new Date(dateTo.getTime() - 7 * 86400000);
  const dateToStr = dateTo.toISOString().split("T")[0];
  const dateFromStr = dateFrom.toISOString().split("T")[0];

  console.log(
    `[sync-meta-ads] Syncing account ${adAccountId} from ${dateFromStr} to ${dateToStr}`
  );

  try {
    // Ensure ad_account record exists
    const { data: adAccount } = await supabase
      .from("ad_accounts")
      .upsert(
        {
          client_id,
          integration_id: integrationId,
          external_id: adAccountId,
          name: `Meta Ads ${adAccountId}`,
          platform: "meta_ads",
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

    // 1. Fetch campaigns
    const campaignsUrl = `${GRAPH_API_BASE}/${adAccountId}/campaigns?fields=id,name,status,objective&limit=500&access_token=${META_ACCESS_TOKEN}`;
    const campResponse = await fetch(campaignsUrl);

    if (!campResponse.ok) {
      const errorText = await campResponse.text();
      throw new Error(`Meta API campaigns error ${campResponse.status}: ${errorText}`);
    }

    const campData = await campResponse.json();
    const campaigns = campData.data || [];

    console.log(`[sync-meta-ads] Found ${campaigns.length} campaigns`);

    // Upsert campaigns
    for (const camp of campaigns) {
      const { error } = await supabase.from("ad_campaigns").upsert(
        {
          ad_account_id: adAccount.id,
          external_id: camp.id,
          name: camp.name,
          status: (camp.status || "UNKNOWN").toLowerCase(),
          campaign_type: camp.objective || "unknown",
          platform: "meta_ads",
        },
        { onConflict: "ad_account_id,external_id" }
      );

      if (error) {
        result.errors.push(`Campaign ${camp.id}: ${error.message}`);
      } else {
        result.campaigns_synced++;
      }
    }

    // 2. Fetch insights (daily breakdown)
    const insightsUrl =
      `${GRAPH_API_BASE}/${adAccountId}/insights?` +
      `fields=campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,actions` +
      `&level=campaign` +
      `&time_range={"since":"${dateFromStr}","until":"${dateToStr}"}` +
      `&time_increment=1` +
      `&limit=500` +
      `&access_token=${META_ACCESS_TOKEN}`;

    const insResponse = await fetch(insightsUrl);

    if (!insResponse.ok) {
      const errorText = await insResponse.text();
      throw new Error(`Meta API insights error ${insResponse.status}: ${errorText}`);
    }

    const insData = await insResponse.json();
    const insights = insData.data || [];

    console.log(`[sync-meta-ads] Fetched ${insights.length} insight rows`);

    // Upsert daily metrics
    for (const row of insights) {
      // Find campaign in our DB
      const { data: campaignRow } = await supabase
        .from("ad_campaigns")
        .select("id")
        .eq("ad_account_id", adAccount.id)
        .eq("external_id", row.campaign_id)
        .single();

      if (!campaignRow) continue;

      // Extract conversions from actions array
      let conversions = 0;
      if (row.actions) {
        const purchaseAction = row.actions.find(
          (a: { action_type: string; value: string }) =>
            a.action_type === "purchase" ||
            a.action_type === "offsite_conversion.fb_pixel_purchase"
        );
        if (purchaseAction) {
          conversions = parseFloat(purchaseAction.value || "0");
        }
      }

      const spend = parseFloat(row.spend || "0");
      const clicks = parseInt(row.clicks || "0");
      const impressions = parseInt(row.impressions || "0");

      const { error } = await supabase.from("ad_daily_metrics").upsert(
        {
          campaign_id: campaignRow.id,
          date: row.date_start,
          spend,
          impressions,
          clicks,
          conversions,
          revenue_reported: 0,
          cpc: clicks > 0 ? spend / clicks : 0,
          cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
          ctr: parseFloat(row.ctr || "0"),
        },
        { onConflict: "campaign_id,date" }
      );

      if (error) {
        result.errors.push(`Metric ${row.campaign_id}/${row.date_start}: ${error.message}`);
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
    console.error(`[sync-meta-ads] Error syncing ${adAccountId}:`, err);
    result.errors.push((err as Error).message);

    await supabase
      .from("integrations")
      .update({
        status: "error",
        config: {
          last_error: (err as Error).message,
          timestamp: new Date().toISOString(),
        },
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
