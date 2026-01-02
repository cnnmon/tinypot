import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export interface MatchRequest {
  userInput: string;
  options: { text: string; aliases?: string[] }[];
}

export interface MatchResponse {
  matched: boolean;
  optionIndex: number | null;
  confidence: number;
  suggestedAlias?: string; // Normalized version to cache
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
      const aliases = opt.aliases?.length ? ` (also: ${opt.aliases.join(", ")})` : "";
      return `${i}: "${opt.text}"${aliases}`;
    })
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-3-5-haiku-latest",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: `You are matching player input to game options. The player wants to take an action in an interactive story.

Available options:
${optionsList}

Player input: "${userInput}"

Does the player's input semantically match any option? Consider:
- Synonyms (e.g., "leave" matches "run away", "depart" matches "exit")
- Intent (e.g., "I want to ride my bike" matches "Ride a bike")
- Paraphrasing (e.g., "get out of here" matches "escape")
- Catch-all options: If no specific option matches but there's a catch-all like "Anything else", "Other", "Something else", "Do something else", etc., match to that with high confidence.

Respond in JSON format only:
{
  "matched": true/false,
  "optionIndex": <number or null if no match>,
  "confidence": <0.0-1.0>,
  "normalizedInput": "<short normalized version of what the player meant>"
}

Only match if confidence >= 0.7. Be strict but fair. Always prefer specific matches over catch-alls, but use catch-alls when available and no specific match exists.`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  
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

    const parsed = JSON.parse(jsonMatch[0]);
    
    return Response.json({
      matched: parsed.matched && parsed.confidence >= 0.7,
      optionIndex: parsed.matched ? parsed.optionIndex : null,
      confidence: parsed.confidence || 0,
      suggestedAlias: parsed.normalizedInput,
    } satisfies MatchResponse);
  } catch {
    return Response.json({
      matched: false,
      optionIndex: null,
      confidence: 0,
    } satisfies MatchResponse);
  }
}


