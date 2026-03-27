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
import { AGENCY_KNOWLEDGE_BASE } from "./knowledge-base.ts";

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
    activity_type: type,
    title,
    content: content ?? null,
    created_by: "system",
  });
}

async function fetchProspectDocuments(prospectId: string): Promise<string> {
  const { data: docs } = await supabase
    .from("prospect_documents")
    .select("*")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!docs || docs.length === 0) return "Aucun document uploadé.";

  const summaries: string[] = [];
  for (const doc of docs) {
    // For text-based files, try to download and read content
    if (doc.file_type && (doc.file_type.includes("text") || doc.file_type.includes("csv"))) {
      try {
        const { data: fileData } = await supabase.storage
          .from("prospect-documents")
          .download(doc.file_path);
        if (fileData) {
          const text = await fileData.text();
          summaries.push(`### Document: ${doc.file_name} (${doc.category})\n${text.slice(0, 2000)}`);
          continue;
        }
      } catch (_) {
        // Fall through to metadata only
      }
    }
    // For non-text files (PDF, images), just include metadata
    summaries.push(`### Document: ${doc.file_name} (catégorie: ${doc.category}, type: ${doc.file_type || "inconnu"}, taille: ${doc.file_size ? Math.round(doc.file_size / 1024) + " Ko" : "inconnue"})`);
  }

  return summaries.join("\n\n");
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

  // 5. Fetch documents
  const docsContext = await fetchProspectDocuments(prospectId);

  // 6. Build prompt
  const systemPrompt =
    "Tu es un commercial expert en marketing digital chez Regen Agency. " +
    "Rédige un email professionnel de proposition commerciale personnalisé. " +
    "L'email doit être structuré avec un objet (sur la première ligne, préfixé par 'Objet: ') puis le corps du message. " +
    "Sois professionnel, engageant et personnalisé en fonction des données du prospect.\n\n" +
    AGENCY_KNOWLEDGE_BASE;

  const userPrompt = `Voici les informations du prospect pour personnaliser l'email :

## Informations entreprise
- Nom entreprise : ${prospect.company_name ?? "Non renseigné"}
- Secteur : ${prospect.company_sector ?? "Non renseigné"}
- Site web : ${prospect.company_website ?? "Non renseigné"}
- Taille : ${prospect.company_size ?? "Non renseigné"}
- SIRET : ${prospect.company_siret ?? "Non renseigné"}
- Adresse : ${prospect.company_address ?? "Non renseigné"}

## Contact
- Nom : ${prospect.contact_first_name ?? ""} ${prospect.contact_last_name ?? ""}
- Email : ${prospect.contact_email ?? "Non renseigné"}
- Téléphone : ${prospect.contact_phone ?? "Non renseigné"}
- Poste : ${prospect.contact_position ?? "Non renseigné"}

## Besoins et contexte
- Services intéressés : ${(prospect.services_interested || []).join(", ") || "Non renseigné"}
- Budget estimé : ${prospect.budget_estimate ?? "Non renseigné"} ${prospect.budget_currency ?? "EUR"}
- Besoins exprimés : ${prospect.needs_summary ?? "Non renseigné"}
- Résumé transcript : ${prospect.firefly_summary ?? "Aucun"}

## Liens associés
${links && links.length > 0 ? links.map((l: Record<string, string>) => `- ${l.label ?? l.url}: ${l.url}`).join("\n") : "Aucun lien"}

## Réponses formulaire
${
  formResponses && formResponses.length > 0
    ? formResponses
        .map(
          (r: Record<string, unknown>) =>
            `- Réponse: ${JSON.stringify(r.response_data)}`,
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
            `- [${a.activity_type}] ${a.title} (${a.created_at})`,
        )
        .join("\n")
    : "Aucune activité"
}

## Documents du prospect
${docsContext}

Langue de l'email : ${language === "en" ? "anglais" : "français"}

Rédige l'email complet avec l'objet en première ligne (format "Objet: ...") puis le corps du message.`;

  // 7. Call Claude
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
    "Tu es un analyste business chez Regen Agency. " +
    "Analyse les informations suivantes sur cette entreprise et extrait un résumé structuré. " +
    "Sois précis, factuel et orienté business. Identifie les opportunités commerciales pour l'agence.\n\n" +
    AGENCY_KNOWLEDGE_BASE;

  const userPrompt = `Analyse les pages web suivantes liées à un prospect et extrais les informations clés :

${pagesContent.join("\n\n---\n\n")}

IMPORTANT : Tu dois répondre en DEUX parties séparées par la ligne "---JSON---"

PARTIE 1 : Analyse textuelle structurée avec :
1. **Secteur d'activité**
2. **Taille estimée** (TPE, PME, ETI ou Grand Groupe)
3. **Indicateurs de chiffre d'affaires**
4. **Présence digitale** (score 1-10 avec justification)
5. **Points forts**
6. **Points faibles**
7. **Opportunités pour Regen Agency**

---JSON---

PARTIE 2 : Un objet JSON STRICT (sans commentaires, sans markdown) avec les champs extraits des pages analysées. Ne remplis QUE les champs dont tu es raisonnablement sûr. Utilise null pour les champs incertains :
{
  "company_sector": "string ou null",
  "company_size": "tpe ou pme ou eti ou grand_groupe ou null",
  "company_siret": "string ou null",
  "company_address": "string ou null",
  "company_website": "string ou null",
  "contact_position": "string ou null",
  "needs_summary": "string ou null",
  "services_interested": ["google_ads","meta_ads","seo","creation_site","tiktok_ads","formation","consulting"] ou null
}`;

  // 4. Call Claude
  const aiResponse = await callClaude(systemPrompt, userPrompt, 2000);

  // 5. Parse structured data and update prospect
  let analysis = aiResponse;
  let extractedFields: Record<string, unknown> = {};

  const jsonSplit = aiResponse.split("---JSON---");
  if (jsonSplit.length >= 2) {
    analysis = jsonSplit[0].trim();
    try {
      const jsonStr = jsonSplit[1].trim().replace(/```json\n?/g, "").replace(/```/g, "").trim();
      extractedFields = JSON.parse(jsonStr);
      // Remove null values
      Object.keys(extractedFields).forEach(k => {
        if (extractedFields[k] === null || extractedFields[k] === undefined) {
          delete extractedFields[k];
        }
      });
      // Update prospect with extracted fields (only non-empty)
      if (Object.keys(extractedFields).length > 0) {
        await supabase.from("prospects").update(extractedFields).eq("id", prospectId);
      }
    } catch (_) {
      console.error("Failed to parse extracted JSON from AI response");
    }
  }

  // 6. Log activity
  await logActivity(
    prospectId,
    "Analyse IA des liens",
    "ai_analysis",
    analysis,
  );

  // 7. Return
  return jsonResponse({
    success: true,
    data: { analysis, extracted_fields: extractedFields },
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
    "Tu es un assistant commercial chez Regen Agency. " +
    "Résume cette conversation commerciale de manière structurée et actionnable. " +
    "Sois concis mais complet. Propose des actions concrètes basées sur les services de l'agence.\n\n" +
    AGENCY_KNOWLEDGE_BASE;

  const userPrompt = `Voici le transcript d'un appel commercial avec un prospect. Résume-le de manière structurée :

${prospect.firefly_transcript}

IMPORTANT : Tu dois répondre en DEUX parties séparées par la ligne "---JSON---"

PARTIE 1 : Résumé structuré avec :
1. **Points clés** : les informations essentielles de la conversation
2. **Besoins exprimés** : ce que le prospect recherche
3. **Budget mentionné** : tout indice sur le budget du prospect
4. **Timeline souhaitée** : délais ou urgences mentionnés
5. **Objections / Préoccupations** : freins ou hésitations du prospect
6. **Prochaines étapes** : ce qui a été convenu pour la suite
7. **Actions suggérées pour l'agence** : recommandations concrètes

---JSON---

PARTIE 2 : Un objet JSON STRICT (sans commentaires, sans markdown) avec les champs extraits de la conversation. Ne remplis QUE les champs mentionnés explicitement. Utilise null pour les champs non mentionnés :
{
  "needs_summary": "string résumant les besoins exprimés, ou null",
  "budget_estimate": nombre en euros ou null,
  "services_interested": ["google_ads","meta_ads","seo","creation_site","tiktok_ads","formation","consulting"] ou null,
  "company_sector": "string ou null",
  "company_size": "tpe ou pme ou eti ou grand_groupe ou null",
  "contact_position": "string ou null",
  "priority": "low ou medium ou high ou urgent ou null"
}`;

  // 4. Call Claude
  const aiResponse = await callClaude(systemPrompt, userPrompt, 2000);

  // 5. Parse structured data
  let summary = aiResponse;
  let extractedFields: Record<string, unknown> = {};

  const jsonSplit = aiResponse.split("---JSON---");
  if (jsonSplit.length >= 2) {
    summary = jsonSplit[0].trim();
    try {
      const jsonStr = jsonSplit[1].trim().replace(/```json\n?/g, "").replace(/```/g, "").trim();
      extractedFields = JSON.parse(jsonStr);
      // Remove null values
      Object.keys(extractedFields).forEach(k => {
        if (extractedFields[k] === null || extractedFields[k] === undefined) {
          delete extractedFields[k];
        }
      });
    } catch (_) {
      console.error("Failed to parse extracted JSON from transcript summary");
    }
  }

  // 6. Save summary + extracted fields on prospect
  const updateData: Record<string, unknown> = { firefly_summary: summary };
  if (Object.keys(extractedFields).length > 0) {
    Object.assign(updateData, extractedFields);
  }
  const { error: updateErr } = await supabase
    .from("prospects")
    .update(updateData)
    .eq("id", prospectId);

  if (updateErr) {
    console.error("Error saving transcript summary:", updateErr);
  }

  // 7. Log activity
  await logActivity(
    prospectId,
    "Résumé Firefly généré par IA",
    "ai_analysis",
    summary,
  );

  // 8. Return
  return jsonResponse({
    success: true,
    data: { summary, extracted_fields: extractedFields },
  });
}

// ── Action: generate_synthesis ──────────

async function handleGenerateSynthesis(prospectId: string) {
  // 1. Fetch ALL data for this prospect
  const { data: prospect } = await supabase.from("prospects").select("*").eq("id", prospectId).single();
  if (!prospect) return jsonResponse({ success: false, error: "Prospect non trouvé" }, 404);

  const { data: links } = await supabase.from("prospect_links").select("*").eq("prospect_id", prospectId);
  const { data: activities } = await supabase.from("prospect_activities").select("*").eq("prospect_id", prospectId).order("created_at", { ascending: false }).limit(30);
  const { data: formResponses } = await supabase.from("prospect_form_responses").select("*").eq("prospect_id", prospectId);
  const docsContext = await fetchProspectDocuments(prospectId);

  // 2. Separate activity types
  const exchanges = (activities || []).filter((a: Record<string, string>) => ["call", "meeting"].includes(a.activity_type));
  const aiAnalyses = (activities || []).filter((a: Record<string, string>) => a.activity_type === "ai_analysis");
  const notes = (activities || []).filter((a: Record<string, string>) => a.activity_type === "note");

  // 3. Build comprehensive prompt
  const systemPrompt =
    "Tu es un directeur commercial senior chez Regen Agency. " +
    "Ta mission est de produire une synthèse globale et stratégique de toutes les informations disponibles sur un prospect. " +
    "Cette synthèse servira de base pour rédiger la proposition commerciale. " +
    "Sois structuré, factuel et orienté action.\n\n" +
    AGENCY_KNOWLEDGE_BASE;

  const userPrompt = `Produis une SYNTHÈSE GLOBALE de ce prospect en agrégeant TOUTES les sources d'information ci-dessous.

## Fiche prospect
- Entreprise : ${prospect.company_name} | Secteur : ${prospect.company_sector || "?"} | Taille : ${prospect.company_size || "?"}
- SIRET : ${prospect.company_siret || "?"} | Site : ${prospect.company_website || "?"}
- Adresse : ${prospect.company_address || "?"}
- Contact : ${prospect.contact_first_name || ""} ${prospect.contact_last_name || ""} | Poste : ${prospect.contact_position || "?"}
- Email : ${prospect.contact_email || "?"} | Tel : ${prospect.contact_phone || "?"}
- Besoins : ${prospect.needs_summary || "Non renseigné"}
- Budget : ${prospect.budget_estimate || "?"} ${prospect.budget_currency || "EUR"}
- Services intéressés : ${(prospect.services_interested || []).join(", ") || "?"}
- Priorité : ${prospect.priority || "?"} | Source : ${prospect.source || "?"}

## Liens (${(links || []).length})
${(links || []).map((l: Record<string, string>) => `- [${l.link_type}] ${l.url}`).join("\n") || "Aucun"}

## Analyses IA précédentes
${aiAnalyses.map((a: Record<string, string>) => `### ${a.title}\n${a.content}`).join("\n\n") || "Aucune analyse"}

## Échanges (${exchanges.length})
${exchanges.map((e: Record<string, string>) => `### ${e.title} (${e.created_at})\n${(e.content || "").slice(0, 500)}`).join("\n\n") || "Aucun échange"}

## Réponses formulaire
${formResponses && formResponses.length > 0 ? formResponses.map((r: Record<string, unknown>) => JSON.stringify(r.response_data)).join("\n") : "Aucune réponse"}

## Documents
${docsContext}

## Notes internes
${notes.map((n: Record<string, string>) => `- ${n.title}: ${n.content || ""}`).join("\n") || "Aucune note"}

---

Rédige une synthèse structurée avec :
1. **Profil de l'entreprise** : résumé de qui ils sont, ce qu'ils font, leur taille et positionnement
2. **Situation digitale actuelle** : site web, SEO, publicité, réseaux sociaux (basé sur les analyses)
3. **Besoins identifiés** : liste priorisée des besoins exprimés et détectés
4. **Budget et timeline** : ce qu'on sait du budget et des délais
5. **Points d'attention** : objections, risques, particularités à prendre en compte
6. **Recommandation stratégique** : quels services proposer, dans quel ordre, avec quelle approche
7. **Prochaines étapes** : actions concrètes à mener`;

  // 4. Call Claude
  const aiResponse = await callClaude(systemPrompt, userPrompt, 3000);

  // 5. Log activity
  await logActivity(prospectId, "Synthèse globale IA", "ai_analysis", aiResponse);

  // 6. Return
  return jsonResponse({ success: true, data: { synthesis: aiResponse } });
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

      case "generate_synthesis":
        return await handleGenerateSynthesis(prospect_id);

      default:
        return jsonResponse(
          {
            success: false,
            error: `Action inconnue: '${action}'. Actions disponibles: generate_email, analyze_links, summarize_transcript, generate_synthesis`,
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
