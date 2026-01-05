import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export interface MetalearningRequest {
  generated: string; // AI generated content
  authored: string; // Author's final version
  approved: boolean; // Whether author accepted or rejected
}

export interface MetalearningResponse {
  success: boolean;
  metalearning: string | null;
  error?: string;
}

/**
 * Analyzes author edits to infer preferences.
 * Returns a brief, actionable preference statement.
 */
export async function POST(req: Request) {
  const { generated, authored, approved }: MetalearningRequest = await req.json();

  if (!generated || !authored) {
    return Response.json({
      success: false,
      metalearning: null,
      error: 'Missing required fields',
    } satisfies MetalearningResponse);
  }

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 64,
    messages: [
      {
        role: 'user',
        content: `Analyze this author's edit to AI-generated content. You are building a global prompt to align with the author's preferences. Output ONE brief sentence about what they prefer.

BEFORE (AI generated):
${generated}

AFTER (author's version):
${authored}

${approved ? 'Author ACCEPTED with edits.' : 'Author REJECTED.'}

If there was no obvious preference, return an empty string: ""

Write exactly ONE sentence, max 15 words. Format: "Prefers X over Y" or "Dislikes X" or "Wants X".
Examples:
- "Prefers direct player guidance over atmospheric descriptions."
- "Dislikes overly formal dialogue."
- "Wants shorter, punchier narrative beats."

Your response (one or zero sentences only):`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  return Response.json({
    success: true,
    metalearning: text.trim(),
  } satisfies MetalearningResponse);
}
