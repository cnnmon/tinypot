import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export interface GenerateRequest {
  userInput: string;
  currentScene: string; // The scene label where player is
  history: string[]; // Recent narrative/choice history for context
  existingOptions: string[]; // What options already exist (to avoid duplication)
  existingScenes: string[]; // All scene labels in the project
  projectLines: string[]; // Full project for style/context
  worldBible?: string; // Optional author's world context
  guidebook?: string; // Author preferences learned from metalearning
}

/**
 * Three types of generation responses:
 * 1. TEXT_ONLY - Just narrative text, no meaningful choice (help text, clarification, flavor)
 * 2. LINK_SCENE - Jump to an existing scene (player wants to return/explore existing content)
 * 3. NEW_FORK - Create a new scene with generated content (player takes a new path)
 */
export type GenerationType = 'TEXT_ONLY' | 'LINK_SCENE' | 'NEW_FORK';

export interface GenerateResponse {
  success: boolean;
  type: GenerationType;
  generatedOption: {
    text: string; // The option text (normalized from user input)
    aliases: string[]; // Alternative phrasings that should match this option
    then: string[]; // Lines of narrative/jumps to add
    newScene?: {
      label: string; // Scene label for new fork
      content: string[]; // Lines of content for the new scene
    };
  } | null;
  error?: string;
}

/**
 * Generates a new branch/option based on player's creative input.
 * Uses project context to maintain consistent style and world.
 *
 * The LLM chooses between three response types:
 * 1. TEXT_ONLY - Just narrative (help text, clarification, flavor that loops back)
 * 2. LINK_SCENE - Jump to an existing scene (player wants to explore existing content)
 * 3. NEW_FORK - Create a new scene (player takes an entirely new path)
 */
export async function POST(req: Request) {
  const {
    userInput,
    currentScene,
    history,
    existingOptions,
    existingScenes,
    projectLines,
    worldBible,
    guidebook,
  }: GenerateRequest = await req.json();

  if (!userInput) {
    return Response.json({
      success: false,
      type: 'TEXT_ONLY',
      generatedOption: null,
      error: 'No input provided',
    } satisfies GenerateResponse);
  }

  // Build context from project
  const projectContext = projectLines.join('\n');
  const historyContext = history.slice(-10).join('\n'); // Last 10 entries for context
  const existingOptionsContext = existingOptions.length
    ? `Existing options at this decision point: ${existingOptions.join(', ')}`
    : 'No existing options yet.';
  const existingScenesContext = existingScenes.length
    ? `All scenes in the project: ${existingScenes.join(', ')}`
    : 'No scenes defined yet.';

  const worldContext = worldBible ? `\nWorld/Style Guide:\n${worldBible}\n` : '';

  const guidebookContext = guidebook
    ? `\nAUTHOR PREFERENCES (follow these closely):\n${guidebook}\n`
    : '';

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 768,
    messages: [
      {
        role: 'user',
        content: `You are a collaborative interactive fiction author. A player has typed something that doesn't match existing options. Determine the best response type and generate appropriate content.

${worldContext}${guidebookContext}
FULL PROJECT (for style reference):
\`\`\`
${projectContext}
\`\`\`

CURRENT SCENE: ${currentScene || '(opening)'}
${existingScenesContext}
${existingOptionsContext}

RECENT HISTORY:
${historyContext || '(start of game)'}

PLAYER'S INPUT: "${userInput}"

First, decide which response type is most appropriate:

1. TEXT_ONLY - Use when:
   - Player is asking for clarification ("what?", "help", "look around")
   - Input is flavor/roleplay that doesn't advance the story
   - Input doesn't represent a meaningful choice
   - Response should loop back to same decision point

2. LINK_SCENE - Use when:
   - Player wants to go somewhere that already exists
   - Input references an existing scene or location
   - Player wants to backtrack or revisit
   - ONLY use if the target scene exists in the project

3. NEW_FORK - Use when:
   - Player is making a genuinely new choice
   - Input represents a meaningful story branch
   - The action would logically lead somewhere new
   - This aligns with the author's style and world

Respond in JSON format only:
{
  "responseType": "TEXT_ONLY" | "LINK_SCENE" | "NEW_FORK",
  "reasoning": "<one sentence explaining your choice>",
  "optionText": "<clean, polished version for display>",
  "aliases": ["<alternative phrasings players might use>"],
  "narrative": ["<line 1>", "<line 2>", ...],
  
  // For LINK_SCENE only:
  "targetScene": "<existing scene label to jump to>",
  
  // For NEW_FORK only:
  "newScene": {
    "label": "<NEW_SCENE_LABEL in CAPS>",
    "content": ["<narrative line 1>", "<narrative line 2>", ...]
  }
}

Guidelines:
- For TEXT_ONLY: provide 1-2 lines of narrative, no jump
- For LINK_SCENE: verify the target exists in the scene list
- For NEW_FORK: create a memorable scene label and 2-4 lines of content
- Match the author's tone and style
- Keep narrative punchy and evocative`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({
        success: false,
        type: 'TEXT_ONLY',
        generatedOption: null,
        error: 'Failed to parse generation response',
      } satisfies GenerateResponse);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const responseType = (parsed.responseType || 'TEXT_ONLY') as GenerationType;

    // Build the "then" block based on response type
    const thenLines: string[] = [];

    if (parsed.narrative && Array.isArray(parsed.narrative)) {
      // Clean up: remove newlines and empty lines
      const cleanedNarrative = parsed.narrative
        .map((line: string) => line.replace(/\n/g, ' ').trim())
        .filter((line: string) => line.length > 0);
      thenLines.push(...cleanedNarrative);
    }

    // Add jump based on response type
    if (responseType === 'LINK_SCENE' && parsed.targetScene) {
      thenLines.push(`> ${parsed.targetScene}`);
    } else if (responseType === 'NEW_FORK' && parsed.newScene?.label) {
      thenLines.push(`> ${parsed.newScene.label}`);
    }
    // TEXT_ONLY has no jump - loops back to current decision point

    // Build aliases array from LLM response only (LLM already includes user input in its aliases)
    // Deduplicate and exclude aliases that match the optionText
    const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
    const optionText = parsed.optionText || userInput;
    const normOptionText = normalize(optionText);
    const seenNormalized = new Set<string>([normOptionText]); // Exclude optionText itself
    const aliases: string[] = [];

    // Add LLM-generated aliases, skipping duplicates and optionText matches
    if (parsed.aliases && Array.isArray(parsed.aliases)) {
      for (const alias of parsed.aliases) {
        const normAlias = normalize(alias);
        if (!seenNormalized.has(normAlias)) {
          seenNormalized.add(normAlias);
          aliases.push(alias);
        }
      }
    }

    // Build new scene content for NEW_FORK
    let newScene: { label: string; content: string[] } | undefined;
    if (responseType === 'NEW_FORK') {
      // Extract scene label from either newScene object or from the jump target in thenLines
      const sceneLabel =
        parsed.newScene?.label ||
        thenLines
          .find((l: string) => l.startsWith('>'))
          ?.slice(1)
          .trim();

      if (sceneLabel) {
        // Get content from newScene or generate minimal content from narrative
        const rawContent =
          parsed.newScene?.content ||
          (parsed.narrative?.length ? parsed.narrative : ['You find yourself somewhere new.']);

        // Clean up: remove newlines from scene content
        const sceneContent = rawContent
          .map((line: string) => line.replace(/\n/g, ' ').trim())
          .filter((line: string) => line.length > 0);

        newScene = {
          label: sceneLabel,
          content: sceneContent,
        };
      }
    }

    return Response.json({
      success: true,
      type: responseType,
      generatedOption: {
        text: parsed.optionText || userInput,
        aliases,
        then: thenLines,
        newScene,
      },
    } satisfies GenerateResponse);
  } catch {
    return Response.json({
      success: false,
      type: 'TEXT_ONLY',
      generatedOption: null,
      error: 'Failed to generate content',
    } satisfies GenerateResponse);
  }
}
