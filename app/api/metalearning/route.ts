import { parseGuidebook } from '@/lib/guidebook';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export interface MetalearningRequest {
  generated: string; // AI generated content
  authored: string; // Author's final version
  existingGuidebook: string; // Current guidebook content (JSON)
}

export interface MetalearningResponse {
  success: boolean;
  newRule: string | null; // Just the rule string to add (or null if none)
  error?: string;
}

/**
 * Analyzes author edits to infer a single preference rule.
 * Returns just the rule string - caller handles adding to guidebook.
 */
export async function POST(req: Request) {
  const { generated, authored, existingGuidebook }: MetalearningRequest = await req.json();

  if (!generated || !authored) {
    return Response.json({
      success: false,
      newRule: null,
      error: 'Missing required fields',
    } satisfies MetalearningResponse);
  }

  // Parse existing guidebook to get rules array
  const settings = parseGuidebook(existingGuidebook);
  const existingRules = settings.rules;

  const existingRulesContext =
    existingRules.length > 0
      ? `\nEXISTING RULES:\n${existingRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n`
      : '\nNO EXISTING RULES.\n';

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 128,
    messages: [
      {
        role: 'user',
        content: `The author edited AI-generated text. Infer ONE creative preference.

BEFORE:
${generated}

AFTER:
${authored}
${existingRulesContext}
Good rules: tone, pacing, player agency, world rules, prose style.
BAD rules: formatting, markup, structure, or anything similar to existing rules.

If no new insight OR similar rule exists, respond: null
Otherwise respond with JUST the rule (max 12 words), no quotes or JSON.`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

  // If LLM says null or empty, no rule
  if (!text || text.toLowerCase() === 'null' || text.length > 100) {
    return Response.json({
      success: true,
      newRule: null,
    } satisfies MetalearningResponse);
  }

  // Check for similarity to existing rules
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const newRuleNorm = normalize(text);
  const newRuleWords = new Set(newRuleNorm.split(/\s+/));

  const isSimilar = existingRules.some((existing) => {
    const existingWords = new Set(normalize(existing).split(/\s+/));
    const sharedWords = [...newRuleWords].filter((w) => existingWords.has(w) && w.length > 3);
    return sharedWords.length / Math.max(newRuleWords.size, existingWords.size) > 0.4;
  });

  if (isSimilar) {
    return Response.json({
      success: true,
      newRule: null,
    } satisfies MetalearningResponse);
  }

  return Response.json({
    success: true,
    newRule: text,
  } satisfies MetalearningResponse);
}
