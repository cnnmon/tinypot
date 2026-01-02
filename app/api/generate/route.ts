import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export interface GenerateRequest {
  userInput: string;
  currentScene: string; // The scene label where player is
  history: string[]; // Recent narrative/choice history for context
  existingOptions: string[]; // What options already exist (to avoid duplication)
  projectLines: string[]; // Full project for style/context
  worldBible?: string; // Optional author's world context
  guidebook?: string; // Author preferences learned from metalearning
}

export interface GenerateResponse {
  success: boolean;
  generatedOption: {
    text: string; // The option text (normalized from user input)
    aliases: string[]; // Alternative phrasings that should match this option
    then: string[]; // Lines of narrative/jumps to add
  } | null;
  error?: string;
}

/**
 * Generates a new branch/option based on player's creative input.
 * Uses project context to maintain consistent style and world.
 */
export async function POST(req: Request) {
  const {
    userInput,
    currentScene,
    history,
    existingOptions,
    projectLines,
    worldBible,
    guidebook,
  }: GenerateRequest = await req.json();

  if (!userInput) {
    return Response.json({
      success: false,
      generatedOption: null,
      error: "No input provided",
    } satisfies GenerateResponse);
  }

  // Build context from project
  const projectContext = projectLines.join("\n");
  const historyContext = history.slice(-10).join("\n"); // Last 10 entries for context
  const existingContext = existingOptions.length
    ? `Existing options at this point: ${existingOptions.join(", ")}`
    : "No existing options yet.";

  const worldContext = worldBible
    ? `\nWorld/Style Guide:\n${worldBible}\n`
    : "";

  const guidebookContext = guidebook
    ? `\nAUTHOR PREFERENCES (follow these closely):\n${guidebook}\n`
    : "";

  const response = await anthropic.messages.create({
    model: "claude-3-5-haiku-latest",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `You are a collaborative interactive fiction author. A player has chosen an action not in the existing options. Generate new narrative content in the author's style.

${worldContext}${guidebookContext}
FULL PROJECT (for style reference):
\`\`\`
${projectContext}
\`\`\`

CURRENT SCENE: ${currentScene || "(opening)"}
RECENT HISTORY:
${historyContext || "(start of game)"}

${existingContext}

PLAYER'S CHOICE: "${userInput}"

Generate a response that:
1. Acknowledges the player's creative choice
2. Provides 1-3 lines of narrative consequence
3. Either loops back to current scene OR leads somewhere logical
4. Matches the tone and style of the existing project

Respond in JSON format only:
{
  "optionText": "<clean, polished version of the player's action for display>",
  "aliases": ["<the player's original input>", "<other short phrasings that should match>"],
  "narrative": ["<line 1>", "<line 2>", ...],
  "jump": "<scene label to jump to, or null to loop back, or 'END' if this ends the story>"
}

For aliases: include the player's exact input plus 1-2 short alternative phrasings (e.g., if input is "what", aliases might be ["what", "huh", "ask"]).

Keep narrative punchy and in the author's voice.`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({
        success: false,
        generatedOption: null,
        error: "Failed to parse generation response",
      } satisfies GenerateResponse);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Build the "then" block in the authoring format
    const thenLines: string[] = [];
    
    if (parsed.narrative && Array.isArray(parsed.narrative)) {
      thenLines.push(...parsed.narrative);
    }
    
    if (parsed.jump) {
      thenLines.push(`> ${parsed.jump}`);
    }

    // Build aliases array, always including the original input
    const aliases: string[] = [];
    if (parsed.aliases && Array.isArray(parsed.aliases)) {
      aliases.push(...parsed.aliases);
    }
    if (!aliases.includes(userInput)) {
      aliases.unshift(userInput);
    }

    return Response.json({
      success: true,
      generatedOption: {
        text: parsed.optionText || userInput,
        aliases,
        then: thenLines,
      },
    } satisfies GenerateResponse);
  } catch {
    return Response.json({
      success: false,
      generatedOption: null,
      error: "Failed to generate content",
    } satisfies GenerateResponse);
  }
}


