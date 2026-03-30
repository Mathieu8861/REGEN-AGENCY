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

// callClaude with optional document attachments (PDF support)
async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  documents?: Array<{ base64: string; mediaType: string; fileName: string }>,
): Promise<string> {
  // Build content array: documents first, then text prompt
  const content: unknown[] = [];

  if (documents && documents.length > 0) {
    for (const doc of documents) {
      if (doc.mediaType === "application/pdf") {
        content.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: doc.base64 },
        });
      } else {
        // Images (PNG, JPEG, etc.)
        content.push({
          type: "image",
          source: { type: "base64", media_type: doc.mediaType, data: doc.base64 },
        });
      }
    }
  }
  content.push({ type: "text", text: userPrompt });

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
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Claude API error (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

// Extract text from PPTX/DOCX (they are ZIP files with XML inside)
async function extractTextFromOfficeFile(blob: Blob, fileName: string): Promise<string> {
  try {
    const { ZipReader, BlobReader, TextWriter } = await import("https://deno.land/x/zipjs@v2.7.34/index.js");
    const reader = new ZipReader(new BlobReader(blob));
    const entries = await reader.getEntries();

    const textParts: string[] = [];
    const isPptx = fileName.toLowerCase().endsWith(".pptx");
    const isDocx = fileName.toLowerCase().endsWith(".docx");

    for (const entry of entries) {
      // PPTX: slides are in ppt/slides/slide*.xml
      // DOCX: content is in word/document.xml
      const isRelevant = isPptx
        ? entry.filename.match(/ppt\/slides\/slide\d+\.xml/)
        : isDocx
        ? entry.filename === "word/document.xml"
        : false;

      if (isRelevant && entry.getData) {
        const writer = new TextWriter();
        const xml = await entry.getData(writer);
        // Strip XML tags, keep text
        const text = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (text.length > 0) textParts.push(text);
      }
    }
    await reader.close();
    return textParts.join("\n\n").slice(0, 5000);
  } catch (err) {
    return `[Erreur extraction texte ${fileName}: ${(err as Error).message}]`;
  }
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

interface DocResult {
  textSummaries: string;
  pdfDocuments: Array<{ base64: string; mediaType: string; fileName: string }>;
}

async function fetchProspectDocuments(prospectId: string): Promise<DocResult> {
  const { data: docs } = await supabase
    .from("prospect_documents")
    .select("*")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false })
    .limit(8);

  const result: DocResult = { textSummaries: "", pdfDocuments: [] };
  if (!docs || docs.length === 0) {
    result.textSummaries = "Aucun document uploadé.";
    return result;
  }

  const summaries: string[] = [];
  for (const doc of docs) {
    const desc = doc.description ? ` — ${doc.description}` : "";

    // 1. Text/CSV files → read as text
    if (doc.file_type && (doc.file_type.includes("text") || doc.file_type.includes("csv"))) {
      try {
        const { data: fileData } = await supabase.storage.from("prospect-documents").download(doc.file_path);
        if (fileData) {
          const text = await fileData.text();
          summaries.push(`### Document: ${doc.file_name} (${doc.category})${desc}\n${text.slice(0, 3000)}`);
          continue;
        }
      } catch (_) { /* fall through */ }
    }

    // 2. PDF files → send as base64 to Claude (native reading)
    if (doc.file_type === "application/pdf") {
      try {
        const { data: fileData } = await supabase.storage.from("prospect-documents").download(doc.file_path);
        if (fileData && doc.file_size && doc.file_size < 5 * 1024 * 1024) { // max 5MB
          const arrayBuf = await fileData.arrayBuffer();
          const bytes = new Uint8Array(arrayBuf);
          // Base64 encode
          let binary = "";
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          const b64 = btoa(binary);
          result.pdfDocuments.push({ base64: b64, mediaType: "application/pdf", fileName: doc.file_name });
          summaries.push(`### Document PDF: ${doc.file_name} (${doc.category})${desc} — [CONTENU LU PAR L'IA]`);
          continue;
        }
      } catch (_) { /* fall through */ }
    }

    // 3. PPTX/DOCX files → extract text from XML inside ZIP
    if (doc.file_name && (doc.file_name.toLowerCase().endsWith(".pptx") || doc.file_name.toLowerCase().endsWith(".docx"))) {
      try {
        const { data: fileData } = await supabase.storage.from("prospect-documents").download(doc.file_path);
        if (fileData) {
          const extractedText = await extractTextFromOfficeFile(fileData, doc.file_name);
          if (extractedText && !extractedText.startsWith("[Erreur")) {
            summaries.push(`### Document: ${doc.file_name} (${doc.category})${desc}\nContenu extrait:\n${extractedText}`);
            continue;
          }
        }
      } catch (_) { /* fall through */ }
    }

    // 4. Fallback: metadata only
    summaries.push(`### Document: ${doc.file_name} (catégorie: ${doc.category}, type: ${doc.file_type || "inconnu"}, taille: ${doc.file_size ? Math.round(doc.file_size / 1024) + " Ko" : "inconnue"})${desc}`);
  }

  result.textSummaries = summaries.join("\n\n");
  return result;
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
  const docsResult = await fetchProspectDocuments(prospectId);

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
${docsResult.textSummaries}

Langue de l'email : ${language === "en" ? "anglais" : "français"}

Rédige l'email complet avec l'objet en première ligne (format "Objet: ...") puis le corps du message.`;

  // 7. Call Claude (with PDF documents if any)
  const aiResponse = await callClaude(systemPrompt, userPrompt, 2000, docsResult.pdfDocuments);

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
      // Update prospect with extracted fields — ONLY fill empty fields, never overwrite
      if (Object.keys(extractedFields).length > 0) {
        const { data: current } = await supabase.from("prospects").select("*").eq("id", prospectId).single();
        if (current) {
          const safeUpdate: Record<string, unknown> = {};
          for (const [key, val] of Object.entries(extractedFields)) {
            const existing = current[key as keyof typeof current];
            // Only fill if the current value is empty/null/undefined
            if (existing === null || existing === undefined || existing === "" ||
                (Array.isArray(existing) && existing.length === 0)) {
              safeUpdate[key] = val;
            }
          }
          if (Object.keys(safeUpdate).length > 0) {
            await supabase.from("prospects").update(safeUpdate).eq("id", prospectId);
          }
        }
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

  // 6. Save summary + extracted fields on prospect — ONLY fill empty fields
  const updateData: Record<string, unknown> = { firefly_summary: summary };
  if (Object.keys(extractedFields).length > 0) {
    const { data: current } = await supabase.from("prospects").select("*").eq("id", prospectId).single();
    if (current) {
      for (const [key, val] of Object.entries(extractedFields)) {
        const existing = current[key as keyof typeof current];
        if (existing === null || existing === undefined || existing === "" ||
            (Array.isArray(existing) && existing.length === 0)) {
          updateData[key] = val;
        }
      }
    }
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
  const { data: services } = await supabase.from("prospect_services").select("*").eq("prospect_id", prospectId).order("created_at");
  const { data: followUps } = await supabase.from("prospect_follow_ups").select("*").eq("prospect_id", prospectId).order("created_at", { ascending: false }).limit(20);
  const docsResult = await fetchProspectDocuments(prospectId);

  // 2. Separate activity types
  const exchanges = (activities || []).filter((a: Record<string, string>) => ["call", "meeting"].includes(a.activity_type));
  const aiAnalyses = (activities || []).filter((a: Record<string, string>) => a.activity_type === "ai_analysis");
  const notes = (activities || []).filter((a: Record<string, string>) => a.activity_type === "note");

  // 3. Build comprehensive prompt
  const systemPrompt =
    "Tu es un directeur commercial senior chez Regen Agency. " +
    "Ta mission est de produire un RÉCAPITULATIF FACTUEL de la situation actuelle avec ce prospect. " +
    "Ce n'est PAS un email, PAS une proposition commerciale. C'est un document INTERNE pour l'équipe. " +
    "Tu résumes ce qu'on sait, ce qui a été fait, et ce qui reste à faire. " +
    "Sois structuré, factuel et concis. Utilise des bullet points.\n\n" +
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
${docsResult.textSummaries}

## Notes internes
${notes.map((n: Record<string, string>) => `- ${n.title}: ${n.content || ""}`).join("\n") || "Aucune note"}

## Services en cours (pipeline)
${(services || []).length > 0 ? (services || []).map((s: Record<string, string>) => `- ${s.service_label} → Statut: ${s.status}${s.price_ht ? " | " + s.price_ht + " EUR HT" : ""}${s.notes ? " | Note: " + s.notes : ""}`).join("\n") : "Aucun service renseigné"}

## Notes de suivi
${(followUps || []).length > 0 ? (followUps || []).map((f: Record<string, string>) => `- [${f.category}] ${f.note} (${f.created_at})`).join("\n") : "Aucune note de suivi"}

## Contexte IA
${prospect.ai_context || "Aucun contexte libre renseigné"}

## Type de relation
${prospect.relationship_type || "prospect"}

## Prochaine action
${prospect.next_action ? prospect.next_action + (prospect.next_action_date ? " (avant le " + prospect.next_action_date + ")" : "") : "Aucune action définie"}

---

Rédige un RÉCAP INTERNE (pas un email, pas une proposition) structuré ainsi :

## 🏢 L'entreprise
Qui sont-ils, ce qu'ils font, taille, positionnement marché

## 🌐 Situation digitale
État actuel du site web, SEO, publicité en ligne, réseaux sociaux (basé sur les analyses des liens)

## 🎯 Besoins identifiés
Liste à puces des besoins exprimés par le prospect et détectés par l'analyse

## 💰 Budget & Délais
Ce qu'on sait du budget et de la timeline souhaitée

## 💬 Historique des échanges
Résumé chronologique de tous les échanges (appels, emails, formulaires)

## ⚠️ Points d'attention
Objections, risques, particularités à garder en tête

## ✅ Actions réalisées
Ce qui a déjà été fait avec ce prospect

## 📋 Prochaines étapes
Ce qu'il reste à faire concrètement

Sois CONCIS. Utilise des bullet points. Si une info n'est pas disponible, écris "Non renseigné" plutôt que d'inventer.`;

  // 4. Call Claude (with PDF documents if any)
  const aiResponse = await callClaude(systemPrompt, userPrompt, 3000, docsResult.pdfDocuments);

  // 5. Log activity
  await logActivity(prospectId, "Synthèse globale IA", "ai_analysis", aiResponse);

  // 6. Return
  return jsonResponse({ success: true, data: { synthesis: aiResponse } });
}

// ── Action: generate_proposal ──────────

async function handleGenerateProposal(prospectId: string, body?: Record<string, unknown>) {
  // 1. Fetch ALL data
  const { data: prospect } = await supabase.from("prospects").select("*").eq("id", prospectId).single();
  if (!prospect) return jsonResponse({ success: false, error: "Prospect non trouvé" }, 404);

  const { data: links } = await supabase.from("prospect_links").select("*").eq("prospect_id", prospectId);
  const { data: activities } = await supabase.from("prospect_activities").select("*").eq("prospect_id", prospectId).order("created_at", { ascending: false }).limit(30);
  const { data: formResponses } = await supabase.from("prospect_form_responses").select("*").eq("prospect_id", prospectId);
  const { data: services } = await supabase.from("prospect_services").select("*").eq("prospect_id", prospectId).order("created_at");
  const { data: followUps } = await supabase.from("prospect_follow_ups").select("*").eq("prospect_id", prospectId).order("created_at", { ascending: false }).limit(20);
  const docsResult = await fetchProspectDocuments(prospectId);

  // Get agency info for the proposal
  const { data: agency } = await supabase.from("agencies").select("*").limit(1).single();

  const exchanges = (activities || []).filter((a: Record<string, string>) => ["call", "meeting"].includes(a.activity_type));
  const aiAnalyses = (activities || []).filter((a: Record<string, string>) => a.activity_type === "ai_analysis");

  // Extra params from frontend
  const selectedServices = body?.selected_services as string[] || [];
  const proposalContext = body?.proposal_context as string || "";
  const modifications = body?.modifications as string || "";
  const previousProposal = body?.previous_proposal as string || "";

  const today = new Date();
  const months = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  const dateStr = today.getDate() + " " + months[today.getMonth()] + " " + today.getFullYear();
  const monthYear = months[today.getMonth()].charAt(0).toUpperCase() + months[today.getMonth()].slice(1) + " " + today.getFullYear();
  const contactName = ((prospect.contact_first_name || "") + " " + (prospect.contact_last_name || "")).trim();

  // 2. Build prompt — generates HTML body using the Regen proposal template CSS classes
  const systemPrompt =
    "Tu es un directeur commercial senior chez Regen Agency. " +
    "Tu rédiges des PROPOSITIONS COMMERCIALES professionnelles en HTML. " +
    "Tu utilises les classes CSS du template Regen Agency pour structurer le document. " +
    "Le document doit être structuré, chiffré avec des prix réalistes, et personnalisé pour le prospect. " +
    "Tu dois retourner UNIQUEMENT du HTML brut (pas de ```html, pas de markdown, juste le HTML). " +
    "NE PAS inclure de balises <html>, <head>, <body>, <style> — retourne uniquement le CONTENU intérieur.\n\n" +
    AGENCY_KNOWLEDGE_BASE;

  const userPrompt = `Génère une PROPOSITION COMMERCIALE en HTML pour ce prospect. Utilise les classes CSS du template Regen Agency.

## Données du prospect
- Entreprise : ${prospect.company_name} | Secteur : ${prospect.company_sector || "?"} | Taille : ${prospect.company_size || "?"}
- Site web : ${prospect.company_website || "?"}
- SIRET : ${prospect.company_siret || "?"} | Adresse : ${prospect.company_address || "?"}
- Contact : ${contactName} | Poste : ${prospect.contact_position || "?"}
- Email : ${prospect.contact_email || "?"} | Tel : ${prospect.contact_phone || "?"}
- Besoins : ${prospect.needs_summary || "Non renseigné"}
- Budget estimé : ${prospect.budget_estimate || "?"} ${prospect.budget_currency || "EUR"}
- Services intéressés : ${(prospect.services_interested || []).join(", ") || "?"}
- Type de relation : ${prospect.relationship_type || "prospect"}
- Contexte IA : ${prospect.ai_context || "Aucun"}

## Services sélectionnés pour cette proposition
${selectedServices.length > 0 ? selectedServices.join(", ") : "Tous les services pertinents"}

${proposalContext ? "## Contexte / précisions\n" + proposalContext : ""}

${modifications ? "## MODIFICATIONS À APPLIQUER sur la proposition précédente\n" + modifications + "\n\nVoici la proposition précédente à modifier :\n" + (typeof previousProposal === 'string' ? previousProposal.slice(0, 3000) : JSON.stringify(previousProposal).slice(0, 3000)) : ""}

## Services en cours (pipeline)
${(services || []).length > 0 ? (services || []).map((s: Record<string, string>) => "- " + s.service_label + " → " + s.status + (s.notes ? " | " + s.notes : "")).join("\n") : "Aucun"}

## Notes de suivi
${(followUps || []).length > 0 ? (followUps || []).map((f: Record<string, string>) => "- [" + f.category + "] " + f.note).join("\n") : "Aucune"}

## Analyses IA
${aiAnalyses.map((a: Record<string, string>) => a.content?.slice(0, 500)).join("\n\n") || "Aucune"}

## Échanges
${exchanges.map((e: Record<string, string>) => e.title + ": " + (e.content || "").slice(0, 300)).join("\n") || "Aucun"}

## Réponses formulaire
${formResponses && formResponses.length > 0 ? formResponses.map((r: Record<string, unknown>) => JSON.stringify(r.response_data)).join("\n") : "Aucune"}

## Documents
${docsResult.textSummaries}

---

GÉNÈRE LE HTML en utilisant EXACTEMENT ces classes CSS. Retourne UNIQUEMENT le HTML sans balises html/head/body/style.

STRUCTURE DU HTML À GÉNÉRER :

1. COVER (obligatoire) :
<div class="cover">
  <div class="wrap">
    <div class="cover-logo">Regen Agency</div>
    <div class="cover-tag">Proposition commerciale</div>
    <h1>Titre principal avec <em>mot-clé en vert</em></h1>
    <p class="cover-sub">Sous-titre descriptif</p>
    <p class="cover-client">${prospect.company_name} × Regen Agency</p>
    <p class="cover-date">${monthYear}</p>
    <p class="cover-conf">Confidentiel — Destiné à ${prospect.company_name}</p>
  </div>
</div>

2. SECTIONS (dans <div class="wrap cnt">) avec numérotation :
<div class="sec rv">
  <div class="sh"><span class="snum">01</span><h2 class="st">Titre section</h2></div>
  <p>Paragraphe...</p>
  <h3 class="su">Sous-titre</h3>
  <ul class="bul"><li><strong>Gras</strong> description</li></ul>
</div>

3. ALERTES :
<div class="al alg"><span class="al-i">💡</span><div>Texte info</div></div>
<div class="al alw"><span class="al-i">⚠</span><div>Texte warning</div></div>

4. TABLEAUX :
<div class="tw"><table><thead class="thg"><tr><th>Col1</th><th>Col2</th></tr></thead>
<tbody><tr><td class="ts">Label</td><td class="tm">Valeur</td></tr></tbody></table></div>

5. DEVIS :
<div class="devis">
  <div class="devis-head"><div><div class="devis-title">Titre devis</div><div class="devis-num">Ref · Date</div></div></div>
  <div class="devis-body">
    <div class="devis-head-cols"><div class="dhc">Prestation</div><div class="dhc" style="text-align:right">Total HT</div></div>
    <div class="devis-line"><div class="dl-name"><strong>Nom prestation</strong><span class="dl-sub">Description</span></div><div class="dl-total">XXX€</div></div>
  </div>
  <div class="devis-total"><div><div class="devis-total-label">Total HT</div></div><div class="devis-total-val">XXXX€ <span style="font-size:16px;color:var(--gr)">HT</span></div></div>
</div>

6. PRICING CARDS (si formules mensuelles) :
<div class="pricing">
  <div class="pcard pcard-std"><div class="pcard-head"><div class="pcard-badge">Sans engagement</div><div class="pcard-price">XXX€</div><div class="pcard-period">HT / mois</div></div><div class="pcard-body"><div class="pcard-item">Item inclus</div></div></div>
  <div class="pcard pcard-reco"><div class="pcard-head"><div class="pcard-badge">Recommandée</div><div class="pcard-price">XXX€</div><div class="pcard-period">HT / mois</div></div><div class="pcard-body"><div class="pcard-item">Item inclus</div></div></div>
</div>

7. FOOTER (obligatoire, à la fin) :
<div class="ft"><div class="wrap"><div class="ftl">Rédigé par <strong>Regen Agency</strong> · ${monthYear} · Confidentiel</div><div class="ftr">REGEN AGENCY — SARL au capital de 200€ — SIRET 985 275 460 00014 — 60 rue François 1er, 75008 Paris — contact.regenagency@gmail.com</div></div></div>

RÈGLES IMPORTANTES :
- Prix RÉALISTES basés sur la grille tarifaire Regen Agency
- Montants en euros HT
- Personnalisé pour ${prospect.company_name} (nom, secteur, besoins réels)
- N'inclus QUE les services pertinents (${selectedServices.length > 0 ? selectedServices.join(", ") : "selon les besoins identifiés"})
- Ajoute class="rv" à chaque <div class="sec"> pour l'animation de révélation
- Retourne UNIQUEMENT le HTML, sans texte avant/après, sans bloc code markdown`;

  // 3. Call Claude (with PDF documents if any)
  const aiResponse = await callClaude(systemPrompt, userPrompt, 8000, docsResult.pdfDocuments);

  // 4. Clean up response — strip any markdown code fences
  let html = aiResponse.trim();
  if (html.startsWith("```")) {
    html = html.replace(/^```(?:html)?\s*/, "").replace(/\s*```$/, "");
  }

  // 5. Save as activity for the proposition.html page to load
  await supabase.from("prospect_activities").insert({
    prospect_id: prospectId,
    activity_type: "proposal_html",
    title: "Proposition commerciale HTML",
    content: html,
    created_by: "system",
  });

  // 6. Log activity
  await logActivity(prospectId, "Proposition commerciale générée", "ai_analysis", "Proposition HTML générée — ouvrir via le lien");

  // 7. Return HTML
  return jsonResponse({ success: true, data: { proposal_html: html, prospect_id: prospectId } });
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

      case "generate_proposal":
        return await handleGenerateProposal(prospect_id, body);

      default:
        return jsonResponse(
          {
            success: false,
            error: `Action inconnue: '${action}'. Actions disponibles: generate_email, analyze_links, summarize_transcript, generate_synthesis, generate_proposal`,
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
