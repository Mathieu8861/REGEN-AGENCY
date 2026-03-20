// ============================================
// REGEN AGENCY - Sync PrestaShop Orders
// Supabase Edge Function (Deno)
//
// Triggers:
//   - pg_cron (every 4 hours)
//   - Manual "Sync now" button from frontend
//
// Flow:
//   1. Read active PrestaShop integrations
//   2. For each: fetch orders + UTM sources from PrestaShop API
//   3. Parse UTMs, detect channels
//   4. Upsert into orders table
//   5. Update integration status + import logs
// ============================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Create admin client (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Types ───────────────────────────────
interface Integration {
  id: string;
  client_id: string;
  platform: string;
  credentials: {
    store_url: string;
    api_key: string;
  };
  last_sync: string | null;
  status: string;
}

interface PrestaShopOrder {
  id: number;
  reference: string;
  date_add: string;
  total_paid: string;
  total_paid_tax_incl: string;
  id_currency: string;
  current_state: string;
  associations?: {
    order_rows?: Array<{
      product_name: string;
      product_quantity: string;
      product_price: string;
    }>;
  };
}

interface RegenOrderSource {
  id_order: string;
  reference: string;
  order_date: string;
  total_ttc: string;
  currency_code: string;
  request_uri: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_id: string | null;
  gclid: string | null;
  gad_campaignid: string | null;
  fbclid: string | null;
  ttclid: string | null;
  channel: string;
}

// ── Main Handler ────────────────────────
serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const targetClientId = body.client_id || null; // Optional: sync only one client
    const trigger = body.trigger || "manual";

    console.log(`[sync-prestashop] Started. Trigger: ${trigger}, Client: ${targetClientId || "all"}`);

    // 1. Get active PrestaShop integrations
    let query = supabase
      .from("integrations")
      .select("*")
      .eq("platform", "prestashop")
      .in("status", ["active", "pending"]);

    if (targetClientId) {
      query = query.eq("client_id", targetClientId);
    }

    const { data: integrations, error: intError } = await query;

    if (intError) throw intError;
    if (!integrations || integrations.length === 0) {
      return jsonResponse({ message: "No active PrestaShop integrations found", synced: 0 });
    }

    const results: Array<{
      client_id: string;
      imported: number;
      skipped: number;
      errors: string[];
    }> = [];

    // 2. Process each integration
    for (const integration of integrations as Integration[]) {
      const result = await syncStore(integration);
      results.push(result);
    }

    const totalImported = results.reduce((s, r) => s + r.imported, 0);
    const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);

    console.log(`[sync-prestashop] Done. Imported: ${totalImported}, Skipped: ${totalSkipped}`);

    return jsonResponse({
      message: "Sync completed",
      results,
      total_imported: totalImported,
      total_skipped: totalSkipped,
    });
  } catch (err) {
    console.error("[sync-prestashop] Fatal error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});

// ── Sync a Single Store ─────────────────
async function syncStore(integration: Integration) {
  const { client_id, credentials, last_sync, id: integrationId } = integration;
  const { store_url, api_key } = credentials;

  const result = { client_id, imported: 0, skipped: 0, errors: [] as string[] };

  // Date range: from last_sync (or 90 days ago) to now
  const dateFrom = last_sync
    ? new Date(last_sync).toISOString().split("T")[0]
    : new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
  const dateTo = new Date().toISOString().split("T")[0];

  console.log(`[sync-prestashop] Syncing ${store_url} from ${dateFrom} to ${dateTo}`);

  try {
    // Try custom module endpoint first (with UTM data)
    let orderSources: RegenOrderSource[] | null = null;

    try {
      orderSources = await fetchRegenOrderSources(store_url, api_key, dateFrom, dateTo);
      console.log(`[sync-prestashop] Custom module: ${orderSources?.length || 0} order sources`);
    } catch (moduleErr) {
      console.warn(`[sync-prestashop] Custom module not available: ${(moduleErr as Error).message}. Falling back to standard API.`);
    }

    // If custom module worked, use that data
    if (orderSources && orderSources.length > 0) {
      for (const source of orderSources) {
        try {
          const { error } = await supabase.from("orders").upsert(
            {
              client_id,
              external_id: source.id_order.toString(),
              reference: source.reference,
              order_date: source.order_date.split(" ")[0], // YYYY-MM-DD
              total_ttc: parseFloat(source.total_ttc) || 0,
              currency: source.currency_code || "EUR",
              source_url: source.request_uri || null,
              channel: source.channel || "direct",
              utm_source: source.utm_source,
              utm_medium: source.utm_medium,
              utm_campaign: source.utm_campaign,
              utm_content: source.utm_content,
              utm_id: source.utm_id,
              gclid: source.gclid,
              gad_campaignid: source.gad_campaignid,
              fbclid: source.fbclid,
              ttclid: source.ttclid,
              import_source: "prestashop_api",
            },
            { onConflict: "client_id,external_id" }
          );

          if (error) {
            result.errors.push(`Order ${source.id_order}: ${error.message}`);
          } else {
            result.imported++;
          }
        } catch (e) {
          result.errors.push(`Order ${source.id_order}: ${(e as Error).message}`);
        }
      }
    } else {
      // Fallback: use standard PrestaShop API (without UTM data)
      const orders = await fetchPrestaShopOrders(store_url, api_key, dateFrom, dateTo);
      console.log(`[sync-prestashop] Standard API: ${orders?.length || 0} orders`);

      if (orders) {
        for (const order of orders) {
          try {
            const totalTtc = parseFloat(order.total_paid_tax_incl || order.total_paid || "0");

            // Build order items
            const items = (order.associations?.order_rows || []).map((row) => ({
              name: row.product_name,
              quantity: parseInt(row.product_quantity) || 1,
              unit_price: parseFloat(row.product_price) || 0,
            }));

            const { error } = await supabase.from("orders").upsert(
              {
                client_id,
                external_id: order.id.toString(),
                reference: order.reference,
                order_date: order.date_add.split(" ")[0],
                total_ttc: totalTtc,
                channel: "direct", // No UTM data without custom module
                import_source: "prestashop_api",
              },
              { onConflict: "client_id,external_id" }
            );

            if (error) {
              result.errors.push(`Order ${order.id}: ${error.message}`);
            } else {
              result.imported++;

              // Insert order items
              if (items.length > 0) {
                const { data: orderRow } = await supabase
                  .from("orders")
                  .select("id")
                  .eq("client_id", client_id)
                  .eq("external_id", order.id.toString())
                  .single();

                if (orderRow) {
                  await supabase.from("order_items").upsert(
                    items.map((item) => ({
                      order_id: orderRow.id,
                      product_name: item.name,
                      quantity: item.quantity,
                      unit_price: item.unit_price,
                    }))
                  );
                }
              }
            }
          } catch (e) {
            result.errors.push(`Order ${order.id}: ${(e as Error).message}`);
          }
        }
      }
    }

    // Update integration status
    await supabase
      .from("integrations")
      .update({
        last_sync: new Date().toISOString(),
        status: result.errors.length === 0 ? "active" : "active", // Still active even with some errors
        config: {
          last_sync_result: {
            imported: result.imported,
            skipped: result.skipped,
            errors: result.errors.length,
            timestamp: new Date().toISOString(),
          },
        },
      })
      .eq("id", integrationId);

    // Log import
    await supabase.from("import_logs").insert({
      client_id,
      source: "prestashop_api",
      status: result.errors.length === 0 ? "completed" : "completed_with_errors",
      rows_imported: result.imported,
      rows_skipped: result.skipped,
      errors: result.errors.length > 0 ? result.errors : null,
    });
  } catch (err) {
    console.error(`[sync-prestashop] Error syncing ${store_url}:`, err);
    result.errors.push((err as Error).message);

    // Mark integration as error
    await supabase
      .from("integrations")
      .update({ status: "error", config: { last_error: (err as Error).message } })
      .eq("id", integrationId);
  }

  return result;
}

// ── Fetch from Custom Module ────────────
async function fetchRegenOrderSources(
  storeUrl: string,
  apiKey: string,
  dateFrom: string,
  dateTo: string
): Promise<RegenOrderSource[]> {
  const url = `${storeUrl}/api/regen_order_sources?output_format=JSON&filter_date_from=${dateFrom}&filter_date_to=${dateTo}`;

  const response = await fetchWithRetry(url, {
    headers: {
      Authorization: "Basic " + btoa(apiKey + ":"),
    },
  });

  if (!response.ok) {
    throw new Error(`Custom module returned ${response.status}`);
  }

  const data = await response.json();
  return data.regen_order_sources || [];
}

// ── Fetch Standard PrestaShop Orders ────
async function fetchPrestaShopOrders(
  storeUrl: string,
  apiKey: string,
  dateFrom: string,
  dateTo: string
): Promise<PrestaShopOrder[]> {
  // Note: PrestaShop date filter uses exclusive boundaries
  const dayBefore = new Date(new Date(dateFrom).getTime() - 86400000).toISOString().split("T")[0];
  const dayAfter = new Date(new Date(dateTo).getTime() + 86400000).toISOString().split("T")[0];

  const url =
    `${storeUrl}/api/orders?display=full&output_format=JSON` +
    `&date=1&filter[date_add]=[${dayBefore},${dayAfter}]` +
    `&sort=[date_add_DESC]&limit=1000`;

  const response = await fetchWithRetry(url, {
    headers: {
      Authorization: "Basic " + btoa(apiKey + ":"),
    },
  });

  if (!response.ok) {
    throw new Error(`PrestaShop API returned ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return data.orders || [];
}

// ── Fetch with Retry ────────────────────
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  delay = 1000
): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
      if (response.status >= 500 && attempt < retries) {
        console.warn(`[sync-prestashop] Server error ${response.status}, retrying (${attempt}/${retries})...`);
        await new Promise((r) => setTimeout(r, delay * attempt));
        continue;
      }
      return response;
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`[sync-prestashop] Fetch error, retrying (${attempt}/${retries}):`, (err as Error).message);
      await new Promise((r) => setTimeout(r, delay * attempt));
    }
  }
  throw new Error("Max retries reached");
}

// ── Helpers ─────────────────────────────
function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
