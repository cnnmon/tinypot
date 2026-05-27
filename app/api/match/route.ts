import OpenAI from 'openai';

const openai = new OpenAI();

const MODEL = 'gpt-5-nano-2025-08-07';
const MIN_SIMILARITY_SCORE = 0.7;

export interface MatchRequest {
  userInput: string;
  options: { text: string; aliases?: string[] }[];
}

export interface MatchResponse {
  matched: boolean;
  optionIndex: number | null;
  confidence: number;
  normalizedInput?: string;
}

interface LLMResponse {
  optionIndex: number;
  confidence: number;
  normalizedInput: string;
}

const FAILED: MatchResponse = { matched: false, optionIndex: null, confidence: 0 };

/**
 * Matches user natural language input against existing options.
 * Returns the best match if similarity is high enough, otherwise null.
 *
 * Uses GPT-5 nano: this is a hot path (called on every player turn), latency-
 * sensitive, and classification-only — exactly nano's sweet spot.
 */
export async function POST(req: Request) {
  const { userInput, options }: MatchRequest = await req.json();

  if (!userInput || !options?.length) return Response.json(FAILED);

  const optionsList = options
    .map((opt, i) => {
      const aliases = opt.aliases?.length ? ` (also: ${opt.aliases.join(', ')})` : '';
      return `${i}: "${opt.text}"${aliases}`;
    })
    .join('\n');

  const system = `You match a player's natural-language input to one of a numbered list of game options.
Consider synonyms, intent, and paraphrasing. If nothing fits, return the closest option with a low confidence.
Reply with strict JSON only: {"optionIndex": <int>, "confidence": <0.0-1.0>, "normalizedInput": "<short normalized version>"}`;

  const fewShot = [
    {
      role: 'user' as const,
      content: `Available options:
0: "Go to the forest"
1: "Visit the castle"
2: "Stay home"

Player input: "I want to explore the woods"`,
    },
    {
      role: 'assistant' as const,
      content: `{"optionIndex": 0, "confidence": 0.92, "normalizedInput": "go to forest"}`,
    },
    {
      role: 'user' as const,
      content: `Available options:
0: "Fight the dragon"
1: "Run away"
2: "Talk to the dragon"

Player input: "let's chat with it"`,
    },
    {
      role: 'assistant' as const,
      content: `{"optionIndex": 2, "confidence": 0.88, "normalizedInput": "talk to dragon"}`,
    },
    {
      role: 'user' as const,
      content: `Available options:
0: "Open the door"
1: "Look through the window"

Player input: "eat a sandwich"`,
    },
    {
      role: 'assistant' as const,
      content: `{"optionIndex": 0, "confidence": 0.05, "normalizedInput": "eat sandwich"}`,
    },
  ];

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    reasoning_effort: 'minimal', // classification only — skip GPT-5's chain-of-thought
    messages: [
      { role: 'system', content: system },
      ...fewShot,
      {
        role: 'user',
        content: `Available options:
${optionsList}

Player input: "${userInput}"`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? '';

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return Response.json(FAILED);

    const { optionIndex, confidence, normalizedInput }: LLMResponse = JSON.parse(jsonMatch[0]);
    const matched = confidence >= MIN_SIMILARITY_SCORE;

    return Response.json({
      matched,
      optionIndex: matched ? optionIndex : null,
      confidence: confidence || 0,
      normalizedInput,
    } satisfies MatchResponse);
  } catch {
    return Response.json(FAILED);
  }
}
