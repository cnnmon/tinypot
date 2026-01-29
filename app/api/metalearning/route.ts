import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export interface MetalearningRequest {
  generated: string; // AI generated content
  authored: string; // Author's final version
  approved: boolean; // Whether author accepted or rejected
  existingGuidebook: string; // Current guidebook content
}

export interface MetalearningResponse {
  success: boolean;
  updatedGuidebook: string | null; // Full updated guidebook
  newRule: string | null; // The rule that was added/updated (for display)
  action: 'add' | 'update' | 'none'; // What action was taken
  previousRule?: string; // The rule that was replaced (for updates)
  error?: string;
}

/**
 * Analyzes author edits to infer preferences.
 * Intelligently updates the guidebook by either:
 * - Updating an existing similar rule
 * - Adding a new rule if novel
 */
export async function POST(req: Request) {
  const { generated, authored, approved, existingGuidebook }: MetalearningRequest = await req.json();

  if (!generated || !authored) {
    return Response.json({
      success: false,
      updatedGuidebook: null,
      newRule: null,
      action: 'none',
      error: 'Missing required fields',
    } satisfies MetalearningResponse);
  }

  // Parse existing guidebook into lines
  const existingLines = existingGuidebook
    ? existingGuidebook
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
    : [];

  const existingRulesContext =
    existingLines.length > 0
      ? `\nEXISTING GUIDEBOOK RULES:\n${existingLines.map((l, i) => `${i + 1}. ${l}`).join('\n')}\n`
      : '\nGUIDEBOOK IS CURRENTLY EMPTY.\n';

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `You help a game author teach their AI what kind of stories to write.

The author edited AI-generated text. What does this reveal about their CREATIVE VISION?

BEFORE:
${generated}

AFTER:
${authored}

${approved ? 'Author ACCEPTED with edits.' : 'Author REJECTED.'}
${existingRulesContext}
Think like a game designer. Good rules describe:
- TONE: "Write with dark humor" or "Keep it lighthearted"
- PACING: "Make encounters feel urgent" or "Let moments breathe"
- PLAYER AGENCY: "Don't let players escape easily" or "Reward creative thinking"
- WORLD RULES: "Magic has consequences" or "NPCs remember past actions"
- PROSE STYLE: "Use punchy sentences" or "Be poetic and evocative"

CRITICAL - when to use "none":
- If ANY existing rule covers the same concept, use "none"
- If the insight is about redundancy/repetition and a rule about that exists, use "none"
- If you can't identify a TRULY NEW insight not already captured, use "none"
- When in doubt, use "none" - the guidebook should stay minimal

BAD rules (never output these):
- Anything about markup, formatting, symbols, or structure
- "Place X before/after Y" - this is about format, not story
- Anything about how scenes or options are organized
- Rules similar to ones that already exist (use "none" instead)

Respond in JSON only:
{
  "action": "update" | "add" | "none",
  "ruleIndex": <number, 1-indexed, only if action is "update">,
  "rule": "<game design directive, max 12 words>",
  "reasoning": "<brief explanation>"
}

JSON response:`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({
        success: true,
        updatedGuidebook: existingGuidebook,
        newRule: null,
        action: 'none',
      } satisfies MetalearningResponse);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.action === 'none' || !parsed.rule) {
      return Response.json({
        success: true,
        updatedGuidebook: existingGuidebook,
        newRule: null,
        action: 'none',
      } satisfies MetalearningResponse);
    }

    // Check if a similar rule already exists (safety net)
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
    const newRuleNorm = normalize(parsed.rule);
    const newRuleWords = new Set(newRuleNorm.split(/\s+/));

    const isSimilarToExisting = existingLines.some((existing) => {
      const existingNorm = normalize(existing);
      const existingWords = new Set(existingNorm.split(/\s+/));

      // Check for significant word overlap (>50% of words shared)
      const sharedWords = [...newRuleWords].filter((w) => existingWords.has(w) && w.length > 3);
      const overlapRatio = sharedWords.length / Math.max(newRuleWords.size, existingWords.size);

      return overlapRatio > 0.4;
    });

    // If similar rule exists, don't add
    if (parsed.action === 'add' && isSimilarToExisting) {
      return Response.json({
        success: true,
        updatedGuidebook: existingGuidebook,
        newRule: null,
        action: 'none',
      } satisfies MetalearningResponse);
    }

    let updatedLines = [...existingLines];
    let previousRule: string | undefined;

    if (parsed.action === 'update' && parsed.ruleIndex) {
      // Update existing rule (1-indexed)
      const idx = parsed.ruleIndex - 1;
      if (idx >= 0 && idx < updatedLines.length) {
        previousRule = updatedLines[idx];
        updatedLines[idx] = parsed.rule;
      }
      // If invalid index, don't add - just skip
    } else if (parsed.action === 'add') {
      updatedLines.push(parsed.rule);
    }

    const updatedGuidebook = updatedLines.join('\n');

    return Response.json({
      success: true,
      updatedGuidebook,
      newRule: parsed.rule,
      action: parsed.action as 'add' | 'update',
      previousRule,
    } satisfies MetalearningResponse);
  } catch {
    return Response.json({
      success: true,
      updatedGuidebook: existingGuidebook,
      newRule: null,
      action: 'none',
    } satisfies MetalearningResponse);
  }
}
