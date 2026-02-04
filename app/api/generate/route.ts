import { AllowsConfig } from '@/types/schema';
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
  allowsConfig?: AllowsConfig; // What the LLM is allowed to generate
  currentVariables?: string[]; // Variables currently set in player state (with counts)
  projectVariables?: string[]; // All variables defined in the project
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
  title: string; // Short descriptive title for this generation (e.g., "Check key", "Look around")
  generatedOption: {
    text: string; // The option text (normalized from user input)
    aliases: string[]; // Alternative phrasings that should match this option
    then: string[]; // Lines of narrative/jumps to add (using new syntax: goto @SCENE)
    newScene?: {
      label: string; // Scene label for new fork
      content: string[]; // Lines of content for the new scene
    };
  } | null;
  error?: string;
}

/**
 * Build constraints string based on allowsConfig
 */
function buildConstraintsPrompt(allowsConfig?: AllowsConfig): string {
  if (!allowsConfig) {
    // Default: allow everything (new scenes, linking, etc.)
    return `
CONSTRAINTS:
- You MAY create new scenes (NEW_FORK is allowed)
- You MAY link to any existing scene using LINK_SCENE
- Use TEXT_ONLY for clarification or flavor that loops back`;
  }

  const { scenes, allowNew, allowAny } = allowsConfig;

  // Check for "none" - only TEXT_ONLY allowed
  if (!allowAny && scenes.length === 0 && !allowNew) {
    return `
CONSTRAINTS:
- You can ONLY use TEXT_ONLY responses
- NO scene linking or new scene creation allowed
- Provide flavor text or clarification that loops back to current scene`;
  }

  const parts: string[] = ['CONSTRAINTS:'];

  if (allowNew) {
    parts.push('- You MAY create new scenes (NEW_FORK is allowed)');
  } else {
    parts.push('- You CANNOT create new scenes (NEW_FORK is NOT allowed)');
  }

  if (allowAny) {
    parts.push('- You MAY link to any existing scene');
  } else if (scenes.length > 0) {
    parts.push(`- You may ONLY link to these specific scenes: ${scenes.join(', ')}`);
  } else {
    parts.push('- You CANNOT link to other scenes');
  }

  parts.push('- TEXT_ONLY is always available for clarification/flavor');

  return parts.join('\n');
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
    allowsConfig,
    currentVariables,
    projectVariables,
  }: GenerateRequest = await req.json();

  if (!userInput) {
    return Response.json({
      success: false,
      type: 'TEXT_ONLY',
      title: '',
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

  const guidebookContext = guidebook ? `\nAUTHOR PREFERENCES (follow these closely):\n${guidebook}\n` : '';

  const constraintsContext = buildConstraintsPrompt(allowsConfig);

  const projectVarsContext =
    projectVariables && projectVariables.length > 0
      ? `\nVARIABLES USED IN THIS PROJECT: ${projectVariables.join(', ')}\n(Use these when appropriate, or create new ones that fit the theme)`
      : '';

  const currentVarsContext =
    currentVariables && currentVariables.length > 0
      ? `\nPLAYER'S CURRENT STATE: ${currentVariables.join(', ')}\n(Variables with counts > 1 shown as "var (N)")`
      : '\nPLAYER\'S CURRENT STATE: (none yet)';

  const variablesContext = projectVarsContext + currentVarsContext;

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
${variablesContext}

RECENT HISTORY:
${historyContext || '(start of game)'}

PLAYER'S INPUT: "${userInput}"

${constraintsContext}

First, decide which response type is most appropriate (respecting the constraints above):

1. TEXT_ONLY - Use when:
   - Player is asking for clarification ("what?", "help", "look around")
   - Input is flavor/roleplay that doesn't advance the story
   - Input doesn't represent a meaningful choice
   - Response should loop back to same decision point
   - (Or when LINK_SCENE/NEW_FORK are not allowed by constraints)

2. LINK_SCENE - Use when:
   - Player wants to go somewhere that already exists
   - Input references an existing scene or location
   - Player wants to backtrack or revisit
   - ONLY use if the target scene exists AND is allowed by constraints

3. NEW_FORK - Use when:
   - Player is making a genuinely new choice
   - Input represents a meaningful story branch
   - The action would logically lead somewhere new
   - This aligns with the author's style and world
   - ONLY use if allowed by constraints

SYNTAX RULES (use these exactly):
- Scene declarations: @SCENE_NAME
- Navigation: goto @SCENE_NAME (or goto @END)
- Choices: if Choice text | alias1 | alias2
- Choices with requires: if Choice text & ?key (choice only available if player has key)
- Increment variable: +var (as its own indented line - adds 1 to counter)
- Decrement variable: -var (as its own indented line - subtracts 1 from counter)
- Conditional blocks: when var (true if >= 1), when !var (true if 0), when var >= N (threshold)
- Metadata: [key: value]

VARIABLE SYSTEM (COUNTERS):
Variables are COUNTERS, not flags. Each +var adds 1, each -var subtracts 1.
Display: "gold" means gold=1, "gold (3)" means gold=3.

Examples:
if buy sword
    -gold
    +sword
    You got a sword!

if attack & ?sword
    You swing your blade.

when gold >= 5
    You can afford the fancy item.
when !gold
    Your pockets are empty.

A "turn" variable auto-increments each player input. Use "when turn >= N" for time-based events.

IMPORTANT: Look at the project's existing variables and use them consistently. Add new variables that fit the project's theme. Variables create meaningful tradeoffs - gaining one thing often means losing another.

Respond in JSON format only:
{
  "responseType": "TEXT_ONLY" | "LINK_SCENE" | "NEW_FORK",
  "reasoning": "<one sentence explaining your choice>",
  "optionText": "<clean, formal choice text that encapsulates the player's intent>",
  "narrative": ["<line 1>", "<line 2>", ...],
  
  // Variable effects (optional but encouraged - use project's existing variables):
  "setsVariable": "<variable name to INCREMENT (+1) when this choice is taken>",
  "unsetsVariable": "<variable name to DECREMENT (-1)>",
  "requiresVariable": "<variable name required (must be >= 1) for this choice>",
  
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
- For LINK_SCENE: verify the target exists in the scene list AND is allowed
- For NEW_FORK: create a memorable scene label and 2-4 lines of content
- Match the author's tone and style
- Keep narrative punchy and evocative
- Use "goto @SCENE_NAME" syntax for navigation
- VARIABLES ARE IMPORTANT: Look at the project's variables and use them!
  - Does this action build on existing themes? Use setsVariable with a project variable.
  - Does this action cost something? Use unsetsVariable.
  - Does this action require something? Use requiresVariable.
  - Create meaningful tradeoffs when possible.`,
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
        title: '',
        generatedOption: null,
        error: 'Failed to parse generation response',
      } satisfies GenerateResponse);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    let responseType = (parsed.responseType || 'TEXT_ONLY') as GenerationType;

    // Enforce constraints - downgrade if LLM violated them
    if (allowsConfig) {
      if (responseType === 'NEW_FORK' && !allowsConfig.allowNew) {
        responseType = 'TEXT_ONLY';
      }
      if (responseType === 'LINK_SCENE') {
        const targetScene = parsed.targetScene;
        if (!allowsConfig.allowAny && allowsConfig.scenes.length > 0) {
          if (!allowsConfig.scenes.includes(targetScene)) {
            responseType = 'TEXT_ONLY';
          }
        }
        if (!allowsConfig.allowAny && allowsConfig.scenes.length === 0 && !allowsConfig.allowNew) {
          responseType = 'TEXT_ONLY';
        }
      }
    }

    // Build the "then" block based on response type
    const thenLines: string[] = [];

    if (parsed.narrative && Array.isArray(parsed.narrative)) {
      // Clean up: remove newlines and empty lines
      const cleanedNarrative = parsed.narrative
        .map((line: string) => line.replace(/\n/g, ' ').trim())
        .filter((line: string) => line.length > 0);
      thenLines.push(...cleanedNarrative);
    }

    // Add jump based on response type (using new goto @ syntax)
    // Clean target by removing any leading @ (LLM might include it)
    if (responseType === 'LINK_SCENE' && parsed.targetScene) {
      const cleanTarget = parsed.targetScene.replace(/^@/, '');
      thenLines.push(`goto @${cleanTarget}`);
    } else if (responseType === 'NEW_FORK' && parsed.newScene?.label) {
      const cleanLabel = parsed.newScene.label.replace(/^@/, '');
      thenLines.push(`goto @${cleanLabel}`);
    }
    // TEXT_ONLY has no jump - loops back to current decision point

    // Build option text - requires uses & ?key syntax, sets/unsets go in then block
    const cleanOptionText = parsed.optionText || userInput;
    const optionTextWithEffects = parsed.requiresVariable
      ? `${cleanOptionText} & ?${parsed.requiresVariable}`
      : cleanOptionText;
    const aliases: string[] = [];

    // Add sets/unsets as standalone lines at the start of the then block
    if (parsed.setsVariable) thenLines.unshift(`+${parsed.setsVariable}`);
    if (parsed.unsetsVariable) thenLines.unshift(`-${parsed.unsetsVariable}`);

    // Build new scene content for NEW_FORK
    let newScene: { label: string; content: string[] } | undefined;
    if (responseType === 'NEW_FORK') {
      // Extract scene label from either newScene object or from the jump target in thenLines
      const sceneLabel =
        parsed.newScene?.label ||
        thenLines
          .find((l: string) => l.startsWith('goto @'))
          ?.slice(6)
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

    // Create a short title from the option text (capitalize, truncate)
    const shortTitle =
      cleanOptionText.charAt(0).toUpperCase() +
      cleanOptionText.slice(1, 30) +
      (cleanOptionText.length > 30 ? '...' : '');

    return Response.json({
      success: true,
      type: responseType,
      title: shortTitle,
      generatedOption: {
        text: optionTextWithEffects,
        aliases,
        then: thenLines,
        newScene,
      },
    } satisfies GenerateResponse);
  } catch {
    return Response.json({
      success: false,
      type: 'TEXT_ONLY',
      title: '',
      generatedOption: null,
      error: 'Failed to generate content',
    } satisfies GenerateResponse);
  }
}
