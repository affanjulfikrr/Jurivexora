import { GoogleGenAI, Type } from '@google/genai';
import { getDb } from '@/lib/db/database';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length < 10) {
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
  });
}

async function withTimeout<T>(promise: Promise<T>, ms = 20000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Gemini API request timed out')), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface AIExecutionResult {
  mode: 'Live Gemini AI' | 'Demo Mode';
  modelVersion: string;
  confidenceScore: number;
  uncertaintyNote: string | null;
  outputText: string;
  structuredData: Record<string, unknown>;
  sourceReferences: string[];
  disclaimer: string;
}

const RESPONSIBLE_AI_RULES = `
CRITICAL SAFETY & RESPONSIBLE AI CONSTRAINTS (MANDATORY):
1. You are a human-centred decision-support assistant for an academic Bangladesh law enforcement R&D system (Jurivexora).
2. NEVER determine guilt, criminality, intent, or credibility.
3. NEVER recommend arrest, detention, sentencing, or use of force.
4. NEVER automatically identify speakers in audio or infer emotion/deception.
5. Every factual claim MUST cite explicit source references (document title, page, line, or timestamp). If source material is insufficient, explicitly state uncertainty.
6. Mark all output clearly as an AI-Generated Draft requiring human verification.
`;

export function getModelState(modelKey: string): {
  id: number;
  version: string;
  status: string;
  globalEnabled: boolean;
  confidenceThreshold: number;
} {
  const db = getDb();
  const model = db
    .prepare('SELECT id, version, status FROM model_registry WHERE model_key = ?')
    .get(modelKey) as { id: number; version: string; status: string } | undefined;

  const globalSetting = db
    .prepare("SELECT value FROM system_settings WHERE key = 'ai_global_enabled'")
    .get() as { value: string } | undefined;

  const thresholdSetting = db
    .prepare("SELECT value FROM system_settings WHERE key = 'ai_confidence_threshold'")
    .get() as { value: string } | undefined;

  return {
    id: model?.id || 1,
    version: 'gemini-2.5-flash',
    status: model?.status || 'Active',
    globalEnabled: globalSetting?.value !== 'false',
    confidenceThreshold: Number(thresholdSetting?.value || 85),
  };
}

export async function runResponsibleAI(params: {
  taskType:
    | 'OCR'
    | 'Summarisation'
    | 'Translation'
    | 'SpeechToText'
    | 'SemanticSearch'
    | 'DuplicateDetection'
    | 'EntityExtraction';
  modelKey: string;
  textInput?: string;
  fileBase64?: string;
  fileMimeType?: string;
  sourceLabel?: string;
  targetLanguage?: 'en' | 'bn';
  comparisonPool?: Array<{ caseNumber: string; title: string; date: string; location: string; description: string }>;
}): Promise<AIExecutionResult> {
  const state = getModelState(params.modelKey);
  if (!state.globalEnabled || state.status === 'Disabled') {
    throw new Error(`AI feature "${params.modelKey}" is currently disabled in AI Governance Console.`);
  }

  const ai = getGeminiClient();
  const modelName = 'gemini-2.5-flash';
  const disclaimer = 'AI-Generated Draft — Requires mandatory human verification before official inclusion.';

  if (!ai) {
    return buildDemoModeResult(params, modelName, disclaimer);
  }

  try {
    const generate = (req: Parameters<typeof ai.models.generateContent>[0]) =>
      withTimeout(ai.models.generateContent(req));

    if (params.taskType === 'OCR') {
      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
      if (params.fileBase64 && params.fileMimeType) {
        parts.push({ inlineData: { mimeType: params.fileMimeType, data: params.fileBase64 } });
      }
      parts.push({
        text: `${RESPONSIBLE_AI_RULES}\nExtract all Bangla and English text accurately from the provided document/image (${params.sourceLabel || 'Uploaded Document'}). Preserve layout cues, identify page/region references, and note any illegible regions.`,
      });
      if (params.textInput) {
        parts.push({ text: `Supplemental text input:\n${params.textInput}` });
      }
      const res = await generate({
        model: modelName,
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              extractedText: { type: Type.STRING },
              detectedLanguages: { type: Type.ARRAY, items: { type: Type.STRING } },
              sourceReferences: { type: Type.ARRAY, items: { type: Type.STRING } },
              confidenceScore: { type: Type.INTEGER },
              uncertaintyNote: { type: Type.STRING },
            },
          },
        },
      });
      const parsed = JSON.parse((res.text || '{}').trim());
      return {
        mode: 'Live Gemini AI',
        modelVersion: modelName,
        confidenceScore: Number(parsed.confidenceScore ?? 89),
        uncertaintyNote: parsed.uncertaintyNote || null,
        outputText: parsed.extractedText || 'No legible text detected.',
        structuredData: parsed,
        sourceReferences: parsed.sourceReferences || [params.sourceLabel || 'Uploaded Document p.1'],
        disclaimer,
      };
    }

    if (params.taskType === 'SpeechToText') {
      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
      if (params.fileBase64 && params.fileMimeType) {
        parts.push({ inlineData: { mimeType: params.fileMimeType, data: params.fileBase64 } });
      }
      parts.push({
        text: `${RESPONSIBLE_AI_RULES}\nTranscribe this audio into Bangla/English text with [MM:SS] timestamps. Do NOT identify or name speakers (label sequentially as Segment 1, Segment 2 if needed). Mark any noisy or ambiguous audio as [Unclear].\n${params.textInput ? `Context note: ${params.textInput}` : ''}`,
      });
      const res = await generate({
        model: modelName,
        contents: { parts },
      });
      const txt = res.text || '[Unclear audio]';
      return {
        mode: 'Live Gemini AI',
        modelVersion: modelName,
        confidenceScore: txt.includes('[Unclear]') ? 79 : 88,
        uncertaintyNote: txt.includes('[Unclear]')
          ? 'Audio contains unclear segments marked [Unclear]; human audio verification required.'
          : null,
        outputText: txt,
        structuredData: { transcript: txt, speakerIdentificationDisabled: true },
        sourceReferences: [params.sourceLabel || 'Authorized Audio Exhibit'],
        disclaimer,
      };
    }

    if (params.taskType === 'Translation') {
      const target = params.targetLanguage === 'bn' ? 'Bangla (বাংলা)' : 'English';
      const res = await generate({
        model: modelName,
        contents: `${RESPONSIBLE_AI_RULES}\nTranslate the following text into ${target}. Preserve legal/factual precision and cite line references. If any idiom or term is ambiguous, highlight it in uncertaintyNote.\n\nSource (${params.sourceLabel || 'Document'}):\n${params.textInput || ''}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              translatedText: { type: Type.STRING },
              sourceReferences: { type: Type.ARRAY, items: { type: Type.STRING } },
              confidenceScore: { type: Type.INTEGER },
              uncertaintyNote: { type: Type.STRING },
            },
          },
        },
      });
      const parsed = JSON.parse((res.text || '{}').trim());
      return {
        mode: 'Live Gemini AI',
        modelVersion: modelName,
        confidenceScore: Number(parsed.confidenceScore ?? 90),
        uncertaintyNote: parsed.uncertaintyNote || null,
        outputText: parsed.translatedText || '',
        structuredData: parsed,
        sourceReferences: parsed.sourceReferences || [params.sourceLabel || 'Source Document'],
        disclaimer,
      };
    }

    if (params.taskType === 'EntityExtraction') {
      const res = await generate({
        model: modelName,
        contents: `${RESPONSIBLE_AI_RULES}\nExtract ONLY objective entities (dates, locations, caseReferences, namedEntities) alongside exact source passages. Do NOT infer guilt, intent, or criminality.\n\nDocument (${params.sourceLabel || 'Case Text'}):\n${params.textInput || ''}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              dates: { type: Type.ARRAY, items: { type: Type.STRING } },
              locations: { type: Type.ARRAY, items: { type: Type.STRING } },
              caseReferences: { type: Type.ARRAY, items: { type: Type.STRING } },
              namedEntities: { type: Type.ARRAY, items: { type: Type.STRING } },
              passages: { type: Type.ARRAY, items: { type: Type.STRING } },
              confidenceScore: { type: Type.INTEGER },
              uncertaintyNote: { type: Type.STRING },
            },
          },
        },
      });
      const parsed = JSON.parse((res.text || '{}').trim());
      return {
        mode: 'Live Gemini AI',
        modelVersion: modelName,
        confidenceScore: Number(parsed.confidenceScore ?? 91),
        uncertaintyNote: parsed.uncertaintyNote || null,
        outputText: `Extracted ${(parsed.dates || []).length} dates, ${(parsed.locations || []).length} locations, ${(parsed.namedEntities || []).length} entities.`,
        structuredData: parsed,
        sourceReferences: parsed.passages || [params.sourceLabel || 'Case Document'],
        disclaimer,
      };
    }

    if (params.taskType === 'DuplicateDetection' || params.taskType === 'SemanticSearch') {
      const poolText = (params.comparisonPool || [])
        .map((c) => `- ${c.caseNumber} | ${c.title} | Date: ${c.date} | Location: ${c.location} | ${c.description}`)
        .join('\n');
      const res = await generate({
        model: modelName,
        contents: `${RESPONSIBLE_AI_RULES}\nTask: ${params.taskType}. Query/Target:\n${params.textInput}\n\nAuthorized Case Pool:\n${poolText}\n\nReturn matching case numbers, similarity percentage (0-100), and factual reasons why they may relate. Never recommend merging automatically.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              matches: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    caseNumber: { type: Type.STRING },
                    similarity: { type: Type.INTEGER },
                    reason: { type: Type.STRING },
                  },
                },
              },
              summary: { type: Type.STRING },
              confidenceScore: { type: Type.INTEGER },
              uncertaintyNote: { type: Type.STRING },
            },
          },
        },
      });
      const parsed = JSON.parse((res.text || '{}').trim());
      return {
        mode: 'Live Gemini AI',
        modelVersion: modelName,
        confidenceScore: Number(parsed.confidenceScore ?? 82),
        uncertaintyNote: parsed.uncertaintyNote || null,
        outputText: parsed.summary || 'Authorized records evaluated.',
        structuredData: parsed,
        sourceReferences: (parsed.matches || []).map((m: { caseNumber: string }) => m.caseNumber),
        disclaimer,
      };
    }

    // Default: Summarisation
    const res = await generate({
      model: modelName,
      contents: `${RESPONSIBLE_AI_RULES}\nSummarize the authorized case document (${params.sourceLabel || 'Document'}). Identify key dates, references, and cite page/line references for every factual claim. Indicate uncertainty if facts are incomplete.\n\n${params.textInput || ''}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            keyDates: { type: Type.ARRAY, items: { type: Type.STRING } },
            keyReferences: { type: Type.ARRAY, items: { type: Type.STRING } },
            sourceReferences: { type: Type.ARRAY, items: { type: Type.STRING } },
            confidenceScore: { type: Type.INTEGER },
            uncertaintyNote: { type: Type.STRING },
          },
        },
      },
    });
    const parsed = JSON.parse((res.text || '{}').trim());
    return {
      mode: 'Live Gemini AI',
      modelVersion: modelName,
      confidenceScore: Number(parsed.confidenceScore ?? 88),
      uncertaintyNote: parsed.uncertaintyNote || null,
      outputText: parsed.summary || '',
      structuredData: parsed,
      sourceReferences: parsed.sourceReferences || [params.sourceLabel || 'Document p.1'],
      disclaimer,
    };
 } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('Gemini execution failed, falling back to Demo Mode:', errMsg);
    const demo = buildDemoModeResult(params, modelName, disclaimer);
    demo.uncertaintyNote = `API Error: ${errMsg}`;
    return demo;
  }
}

function buildDemoModeResult(
  params: {
    taskType: string;
    textInput?: string;
    sourceLabel?: string;
    targetLanguage?: 'en' | 'bn';
    comparisonPool?: Array<{ caseNumber: string; title: string; date: string; location: string; description: string }>;
  },
  modelVersion: string,
  disclaimer: string
): AIExecutionResult {
  const input = (params.textInput || '').trim();
  const src = params.sourceLabel || 'Submitted Case Artifact';

  if (params.taskType === 'OCR') {
    const extracted =
      input ||
      '[Demo Mode OCR Output]\nনথি শিরোনাম: প্রাথমিক তদন্ত প্রতিবেদন (ঢাকা)\nReference: JRX-DHK-2026-0041\nDate: 18 October 2026\nExtracted region [Page 1, Zone B]: Bank hold reference verified against submitted exhibit.';
    return {
      mode: 'Demo Mode',
      modelVersion: `${modelVersion} (Demo Mode)`,
      confidenceScore: 87,
      uncertaintyNote: 'Demo Mode active (GEMINI_API_KEY unavailable or simulated for academic demonstration). Verify against original scanned artifact.',
      outputText: extracted,
      structuredData: { extractedText: extracted, detectedLanguages: ['bn', 'en'], pages: 1 },
      sourceReferences: [`${src} · Page 1, Region A-B`],
      disclaimer,
    };
  }

  if (params.taskType === 'Translation') {
    const isToBn = params.targetLanguage === 'bn';
    const translated = isToBn
      ? `[খসড়া অনুবাদ — Demo Mode] উৎস নথি (${src}): "${input.slice(0, 220) || 'ব্যাংক কমপ্লায়েন্স বিভাগ লেনদেন স্থগিত করেছে এবং নথিপত্র যাচাই চলছে।'}"`
      : `[Draft Translation — Demo Mode] Source (${src}): "Citizens reported suspicious MFS verification calls and utility SMS links in the Dhaka metropolitan region. All statements require human corroboration."`;
    return {
      mode: 'Demo Mode',
      modelVersion: `${modelVersion} (Demo Mode)`,
      confidenceScore: 86,
      uncertaintyNote: 'Demo Mode translation draft. Confirm legal terminology in Bangla and English before official use.',
      outputText: translated,
      structuredData: { translatedText: translated, targetLanguage: params.targetLanguage || 'en' },
      sourceReferences: [`${src} · Paragraph 1`],
      disclaimer,
    };
  }

  if (params.taskType === 'SpeechToText') {
    const transcript = `[00:00] Segment 1 (Speaker ID disabled): "হ্যালো, আমি মিরপুর ১০ নম্বর এলাকা থেকে বলছি।"\n[00:09] Segment 1: "একটি অজানা নম্বর থেকে বিদ্যুৎ বিল যাচাইয়ের নামে কোড চাওয়া হয়েছিল।"\n[00:18] [Unclear — street noise 4s]\n[00:23] Segment 1: "আমি কোনো কোড শেয়ার করিনি এবং স্ক্রিনশট সংরক্ষণ করেছি।"`;
    return {
      mode: 'Demo Mode',
      modelVersion: `${modelVersion} (Demo Mode)`,
      confidenceScore: 78,
      uncertaintyNote: 'Unclear audio detected at [00:18] and Demo Mode active. Human audio review required.',
      outputText: transcript,
      structuredData: { transcript, speakerIdentificationDisabled: true },
      sourceReferences: [`${src} · 00:00–00:27`],
      disclaimer,
    };
  }

  if (params.taskType === 'EntityExtraction') {
    const dateMatches = input.match(/\b\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4}-\d{2}-\d{2}/g) || ['2026-10-18'];
    const refMatches = input.match(/JRX-[A-Z]+-\d{4}-\d{4}|EVD-\d{4}-\d{4}|PUB-BD-\d{4}-\d{4}/g) || ['JRX-DHK-2026-0041'];
    const locMatches = ['Dhaka', 'Motijheel', 'Mirpur', 'Chattogram', 'Sylhet'].filter((l) =>
      input.toLowerCase().includes(l.toLowerCase())
    );
    const locations = locMatches.length ? locMatches : ['Dhaka (from context)'];
    return {
      mode: 'Demo Mode',
      modelVersion: `${modelVersion} (Demo Mode)`,
      confidenceScore: 90,
      uncertaintyNote: 'Demo Mode deterministic extraction. Verify passages against original file.',
      outputText: `Extracted ${dateMatches.length} date(s), ${locations.length} location(s), and ${refMatches.length} case reference(s).`,
      structuredData: {
        dates: dateMatches,
        locations,
        caseReferences: refMatches,
        namedEntities: ['Bangladesh Commercial Bank Desk', 'Utility Billing Desk'],
        passages: [input.slice(0, 160) || `${src} · Line 1`],
      },
      sourceReferences: [`${src} · Inline Extraction`],
      disclaimer,
    };
  }

  if (params.taskType === 'DuplicateDetection' || params.taskType === 'SemanticSearch') {
    const queryWords = input.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const matches = (params.comparisonPool || [])
      .map((c) => {
        const hay = `${c.title} ${c.location} ${c.description}`.toLowerCase();
        const hits = queryWords.filter((w) => hay.includes(w));
        const similarity = Math.min(92, 48 + hits.length * 14);
        return {
          caseNumber: c.caseNumber,
          title: c.title,
          similarity,
          reason: hits.length
            ? `Shared operational terms (${hits.slice(0, 4).join(', ')}) in ${c.location}.`
            : `Regional category similarity in ${c.location}.`,
        };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);

    const topSim = matches[0]?.similarity ?? 72;
    return {
      mode: 'Demo Mode',
      modelVersion: `${modelVersion} (Demo Mode)`,
      confidenceScore: topSim,
      uncertaintyNote:
        topSim < 85
          ? 'Below 85% research confidence threshold; human investigator must verify before linking.'
          : 'Demo Mode semantic scoring. Automatic case merging is permanently disabled.',
      outputText:
        matches.length > 0
          ? `Evaluated ${params.comparisonPool?.length || 0} authorized cases; top match ${matches[0].caseNumber} (${matches[0].similarity}%).`
          : 'No matching authorized cases found.',
      structuredData: { matches },
      sourceReferences: matches.map((m) => m.caseNumber),
      disclaimer,
    };
  }

  // Summarisation
  const snippet = input.slice(0, 180) || 'Submitted case memorandum';
  return {
    mode: 'Demo Mode',
    modelVersion: `${modelVersion} (Demo Mode)`,
    confidenceScore: 86,
    uncertaintyNote: 'Demo Mode summary generated for demonstration. Review source excerpts carefully.',
    outputText: `Draft Summary (${src}): ${snippet}${input.length > 180 ? '...' : ''} — Key dates and references preserved for investigator review without guilt or intent inference.`,
    structuredData: {
      summary: `Draft Summary (${src}): ${snippet}`,
      keyDates: ['2026-10-18', '2026-11-02'],
      keyReferences: ['JRX-DHK-2026-0041'],
    },
    sourceReferences: [`${src} · Page 1`],
    disclaimer,
  };
}
