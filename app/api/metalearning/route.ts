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
  error?: string;
}

/**
 * Analyzes author edits to infer preferences.
 * Intelligently updates the guidebook by either:
 * - Updating an existing similar rule
 * - Adding a new rule if novel
 */
export async function POST(req: Request) {
  const { generated, authored, approved, existingGuidebook }: MetalearningRequest =
    await req.json();

  if (!generated || !authored) {
    return Response.json({
      success: false,
      updatedGuidebook: null,
      newRule: null,
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

BAD rules (never output these):
- Anything about markup, formatting, symbols, or structure
- "Place X before/after Y" - this is about format, not story
- Anything about how scenes or options are organized

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
      } satisfies MetalearningResponse);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.action === 'none' || !parsed.rule) {
      return Response.json({
        success: true,
        updatedGuidebook: existingGuidebook,
        newRule: null,
      } satisfies MetalearningResponse);
    }

    let updatedLines = [...existingLines];

    if (parsed.action === 'update' && parsed.ruleIndex) {
      // Update existing rule (1-indexed)
      const idx = parsed.ruleIndex - 1;
      if (idx >= 0 && idx < updatedLines.length) {
        updatedLines[idx] = parsed.rule;
      } else {
        // Invalid index, just add as new
        updatedLines.push(parsed.rule);
      }
    } else if (parsed.action === 'add') {
      updatedLines.push(parsed.rule);
    }

    const updatedGuidebook = updatedLines.join('\n');

    return Response.json({
      success: true,
      updatedGuidebook,
      newRule: parsed.rule,
    } satisfies MetalearningResponse);
  } catch {
    return Response.json({
      success: true,
      updatedGuidebook: existingGuidebook,
      newRule: null,
    } satisfies MetalearningResponse);
  }
}
