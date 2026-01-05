import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

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

/**
 * Matches user natural language input against existing options.
 * Returns the best match if similarity is high enough, otherwise null.
 */
export async function POST(req: Request) {
  const { userInput, options }: MatchRequest = await req.json();

  if (!userInput || !options?.length) {
    return Response.json({
      matched: false,
      optionIndex: null,
      confidence: 0,
    } satisfies MatchResponse);
  }

  // Build a list of all possible matches (options + their aliases)
  const optionsList = options
    .map((opt, i) => {
      const aliases = opt.aliases?.length ? ` (also: ${opt.aliases.join(', ')})` : '';
      return `${i}: "${opt.text}"${aliases}`;
    })
    .join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `You are matching player input to game options. Find the most similar option and return a similarity probability.

Available options:
0: "Go to the forest"
1: "Visit the castle"
2: "Stay home"

Player input: "I want to explore the woods"

Return the most similar option with its similarity probability. Consider synonyms, intent, and paraphrasing.
Respond in JSON: {"optionIndex": <number>, "confidence": <0.0-1.0>, "normalizedInput": "<short normalized version>"}`,
      },
      {
        role: 'assistant',
        content: `{"optionIndex": 0, "confidence": 0.92, "normalizedInput": "go to forest"}`,
      },
      {
        role: 'user',
        content: `Available options:
0: "Fight the dragon"
1: "Run away"
2: "Talk to the dragon"

Player input: "let's chat with it"

Return the most similar option with its similarity probability. Consider synonyms, intent, and paraphrasing.
Respond in JSON: {"optionIndex": <number>, "confidence": <0.0-1.0>, "normalizedInput": "<short normalized version>"}`,
      },
      {
        role: 'assistant',
        content: `{"optionIndex": 2, "confidence": 0.88, "normalizedInput": "talk to dragon"}`,
      },
      {
        role: 'user',
        content: `Available options:
0: "Open the door"
1: "Look through the window"

Player input: "eat a sandwich"

Return the most similar option with its similarity probability. Consider synonyms, intent, and paraphrasing.
Respond in JSON: {"optionIndex": <number>, "confidence": <0.0-1.0>, "normalizedInput": "<short normalized version>"}`,
      },
      {
        role: 'assistant',
        content: `{"optionIndex": 0, "confidence": 0.05, "normalizedInput": "eat sandwich"}`,
      },
      {
        role: 'user',
        content: `Available options:
${optionsList}

Player input: "${userInput}"

Return the most similar option with its similarity probability. Consider synonyms, intent, and paraphrasing.
Respond in JSON: {"optionIndex": <number>, "confidence": <0.0-1.0>, "normalizedInput": "<short normalized version>"}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({
        matched: false,
        optionIndex: null,
        confidence: 0,
      } satisfies MatchResponse);
    }

    const parsed: LLMResponse = JSON.parse(jsonMatch[0]);
    const { optionIndex, confidence, normalizedInput } = parsed;

    const matched = confidence >= MIN_SIMILARITY_SCORE;

    return Response.json({
      matched,
      optionIndex: matched ? optionIndex : null,
      confidence: confidence || 0,
      normalizedInput,
    } satisfies MatchResponse);
  } catch {
    return Response.json({
      matched: false,
      optionIndex: null,
      confidence: 0,
    } satisfies MatchResponse);
  }
}
