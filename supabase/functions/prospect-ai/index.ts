// ============================================
// REGEN AGENCY - Prospect AI Assistant
// Supabase Edge Function (Deno)
//
// Actions:
//   - generate_email: Generate a personalized sales email for a prospect
//   - analyze_links: Analyze prospect's web links to extract business insights
//   - summarize_transcript: Summarize a Firefly call transcript
//
// Prerequisites (stored as Edge Function secrets):
//   - ANTHROPIC_API_KEY
// ============================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CLAUDE_MODEL = "claude-sonnet-4-20250514";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Helpers ───────────────────────────────

function jsonResponse(
  body: { success: boolean; data?: unknown; error?: string },
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Claude API error (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

async function logActivity(
  prospectId: string,
  title: string,
  type: string,
  content?: string,
) {
  await supabase.from("prospect_activities").insert({
    prospect_id: prospectId,
    type,
    title,
    content: content ?? null,
    created_at: new Date().toISOString(),
  });
}

async function fetchPageContent(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; RegenAgencyBot/1.0; +https://regenagency.fr)",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return `[Erreur HTTP ${res.status} pour ${url}]`;
    const html = await res.text();
    // Strip HTML tags and keep text only, truncate to ~3000 chars
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 3000);
  } catch (err) {
    return `[Impossible de récupérer ${url}: ${(err as Error).message}]`;
  }
}

// ── Action: generate_email ───────────────

async function handleGenerateEmail(prospectId: string, language: string) {
  // 1. Fetch prospect
  const { data: prospect, error: pErr } = await supabase
    .from("prospects")
    .select("*")
    .eq("id", prospectId)
    .single();

  if (pErr || !prospect) {
    return jsonResponse(
      { success: false, error: "Prospect non trouvé" },
      404,
    );
  }

  // 2. Fetch prospect links
  const { data: links } = await supabase
    .from("prospect_links")
    .select("*")
    .eq("prospect_id", prospectId);

  // 3. Fetch form responses
  const { data: formResponses } = await supabase
    .from("prospect_form_responses")
    .select("*")
    .eq("prospect_id", prospectId);

  // 4. Fetch last 10 activities
  const { data: activities } = await supabase
    .from("prospect_activities")
    .select("*")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false })
    .limit(10);

  // 5. Build prompt
  const systemPrompt =
    "Tu es un commercial expert en marketing digital chez Regen Agency, une agence spécialisée en Google Ads, Meta Ads, SEO et création de sites web. Rédige un email professionnel de proposition commerciale personnalisé. " +
    "L'email doit être structuré avec un objet (sur la première ligne, préfixé par 'Objet: ') puis le corps du message. " +
    "Sois professionnel, engageant et personnalisé en fonction des données du prospect.";

  const userPrompt = `Voici les informations du prospect pour personnaliser l'email :

## Informations entreprise
- Nom entreprise : ${prospect.company_name ?? "Non renseigné"}
- Secteur : ${prospect.sector ?? "Non renseigné"}
- Site web : ${prospect.website ?? "Non renseigné"}
- Ville : ${prospect.city ?? "Non renseigné"}
- Pays : ${prospect.country ?? "Non renseigné"}

## Contact
- Nom : ${prospect.first_name ?? ""} ${prospect.last_name ?? ""}
- Email : ${prospect.email ?? "Non renseigné"}
- Téléphone : ${prospect.phone ?? "Non renseigné"}
- Poste : ${prospect.job_title ?? "Non renseigné"}

## Besoins et contexte
- Services intéressés : ${prospect.services_interested ?? "Non renseigné"}
- Budget estimé : ${prospect.budget ?? "Non renseigné"}
- Besoins exprimés : ${prospect.needs ?? "Non renseigné"}
- Notes : ${prospect.notes ?? "Aucune"}
- Résumé transcript : ${prospect.firefly_summary ?? "Aucun"}

## Liens associés
${links && links.length > 0 ? links.map((l: Record<string, string>) => `- ${l.label ?? l.url}: ${l.url}`).join("\n") : "Aucun lien"}

## Réponses formulaire
${
  formResponses && formResponses.length > 0
    ? formResponses
        .map(
          (r: Record<string, string>) =>
            `- ${r.question ?? r.field_name}: ${r.answer ?? r.value}`,
        )
        .join("\n")
    : "Aucune réponse"
}

## Dernières activités
${
  activities && activities.length > 0
    ? activities
        .map(
          (a: Record<string, string>) =>
            `- [${a.type}] ${a.title} (${a.created_at})`,
        )
        .join("\n")
    : "Aucune activité"
}

Langue de l'email : ${language === "en" ? "anglais" : "français"}

Rédige l'email complet avec l'objet en première ligne (format "Objet: ...") puis le corps du message.`;

  // 6. Call Claude
  const aiResponse = await callClaude(systemPrompt, userPrompt, 2000);

  // 7. Parse subject and body
  let emailSubject = "";
  let emailBody = aiResponse;

  const lines = aiResponse.split("\n");
  const subjectLine = lines.find((l: string) =>
    l.toLowerCase().startsWith("objet:") ||
    l.toLowerCase().startsWith("objet :"),
  );
  if (subjectLine) {
    emailSubject = subjectLine.replace(/^objet\s*:\s*/i, "").trim();
    emailBody = lines
      .filter((l: string) => l !== subjectLine)
      .join("\n")
      .trim();
  }

  // 8. Save draft on prospect
  const { error: updateErr } = await supabase
    .from("prospects")
    .update({
      email_draft: emailBody,
      email_subject: emailSubject,
    })
    .eq("id", prospectId);

  if (updateErr) {
    console.error("Error saving email draft:", updateErr);
  }

  // 9. Log activity
  await logActivity(
    prospectId,
    "Email de proposition généré par IA",
    "ai_analysis",
    `Objet: ${emailSubject}`,
  );

  // 10. Return
  return jsonResponse({
    success: true,
    data: {
      subject: emailSubject,
      body: emailBody,
    },
  });
}

// ── Action: analyze_links ────────────────

async function handleAnalyzeLinks(prospectId: string) {
  // 1. Fetch prospect links
  const { data: links, error: lErr } = await supabase
    .from("prospect_links")
    .select("*")
    .eq("prospect_id", prospectId);

  if (lErr || !links || links.length === 0) {
    return jsonResponse(
      { success: false, error: "Aucun lien trouvé pour ce prospect" },
      404,
    );
  }

  // 2. Fetch page content for each link (max 5)
  const linksToAnalyze = links.slice(0, 5);
  const pagesContent: string[] = [];

  for (const link of linksToAnalyze) {
    const content = await fetchPageContent(link.url);
    pagesContent.push(`### ${link.label ?? link.url}\nURL: ${link.url}\n\n${content}`);
  }

  // 3. Build prompt
  const systemPrompt =
    "Tu es un analyste business chez Regen Agency, une agence spécialisée en marketing digital (Google Ads, Meta Ads, SEO, création de sites web). " +
    "Analyse les informations suivantes sur cette entreprise et extrait un résumé structuré. " +
    "Sois précis, factuel et orienté business.";

  const userPrompt = `Analyse les pages web suivantes liées à un prospect et extrais les informations clés :

${pagesContent.join("\n\n---\n\n")}

Fournis une analyse structurée avec les sections suivantes :
1. **Secteur d'activité** : quel est le domaine de l'entreprise ?
2. **Taille estimée** : petite, moyenne ou grande entreprise (indices trouvés)
3. **Indicateurs de chiffre d'affaires** : tout indice sur le volume d'activité
4. **Présence digitale** : score de 1 à 10 avec justification (qualité du site, SEO apparent, réseaux sociaux, etc.)
5. **Points forts** : ce que l'entreprise fait bien
6. **Points faibles** : lacunes identifiées dans leur présence en ligne
7. **Opportunités pour Regen Agency** : services que nous pourrions proposer et pourquoi`;

  // 4. Call Claude
  const aiResponse = await callClaude(systemPrompt, userPrompt, 1500);

  // 5. Log activity
  await logActivity(
    prospectId,
    "Analyse IA des liens",
    "ai_analysis",
    aiResponse,
  );

  // 6. Return
  return jsonResponse({
    success: true,
    data: { analysis: aiResponse },
  });
}

// ── Action: summarize_transcript ─────────

async function handleSummarizeTranscript(prospectId: string) {
  // 1. Fetch prospect transcript
  const { data: prospect, error: pErr } = await supabase
    .from("prospects")
    .select("firefly_transcript")
    .eq("id", prospectId)
    .single();

  if (pErr || !prospect) {
    return jsonResponse(
      { success: false, error: "Prospect non trouvé" },
      404,
    );
  }

  // 2. Check transcript exists
  if (!prospect.firefly_transcript) {
    return jsonResponse(
      {
        success: false,
        error: "Aucun transcript Firefly disponible pour ce prospect",
      },
      400,
    );
  }

  // 3. Build prompt
  const systemPrompt =
    "Tu es un assistant commercial chez Regen Agency, une agence spécialisée en marketing digital (Google Ads, Meta Ads, SEO, création de sites web). " +
    "Résume cette conversation commerciale de manière structurée et actionnable. " +
    "Sois concis mais complet.";

  const userPrompt = `Voici le transcript d'un appel commercial avec un prospect. Résume-le de manière structurée :

${prospect.firefly_transcript}

Fournis un résumé avec les sections suivantes :
1. **Points clés** : les informations essentielles de la conversation
2. **Besoins exprimés** : ce que le prospect recherche
3. **Budget mentionné** : tout indice sur le budget du prospect
4. **Timeline souhaitée** : délais ou urgences mentionnés
5. **Objections / Préoccupations** : freins ou hésitations du prospect
6. **Prochaines étapes** : ce qui a été convenu pour la suite
7. **Actions suggérées pour l'agence** : recommandations concrètes pour avancer avec ce prospect`;

  // 4. Call Claude
  const aiResponse = await callClaude(systemPrompt, userPrompt, 1500);

  // 5. Save summary on prospect
  const { error: updateErr } = await supabase
    .from("prospects")
    .update({ firefly_summary: aiResponse })
    .eq("id", prospectId);

  if (updateErr) {
    console.error("Error saving transcript summary:", updateErr);
  }

  // 6. Log activity
  await logActivity(
    prospectId,
    "Résumé Firefly généré par IA",
    "ai_analysis",
    aiResponse,
  );

  // 7. Return
  return jsonResponse({
    success: true,
    data: { summary: aiResponse },
  });
}

// ── Main handler ─────────────────────────

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Check API key
  if (!ANTHROPIC_API_KEY) {
    return jsonResponse(
      {
        success: false,
        error:
          "ANTHROPIC_API_KEY non configurée. Ajoutez-la dans les secrets de la fonction.",
      },
      500,
    );
  }

  try {
    const body = await req.json();
    const { action, prospect_id, language } = body;

    if (!action) {
      return jsonResponse(
        { success: false, error: "Le champ 'action' est requis" },
        400,
      );
    }

    if (!prospect_id) {
      return jsonResponse(
        { success: false, error: "Le champ 'prospect_id' est requis" },
        400,
      );
    }

    switch (action) {
      case "generate_email":
        return await handleGenerateEmail(prospect_id, language ?? "fr");

      case "analyze_links":
        return await handleAnalyzeLinks(prospect_id);

      case "summarize_transcript":
        return await handleSummarizeTranscript(prospect_id);

      default:
        return jsonResponse(
          {
            success: false,
            error: `Action inconnue: '${action}'. Actions disponibles: generate_email, analyze_links, summarize_transcript`,
          },
          400,
        );
    }
  } catch (err) {
    console.error("prospect-ai error:", err);

    // Distinguish Claude API errors from other errors
    const message = (err as Error).message ?? "Erreur interne";
    const isClaudeError = message.includes("Claude API error");

    return jsonResponse(
      { success: false, error: message },
      isClaudeError ? 502 : 500,
    );
  }
});
