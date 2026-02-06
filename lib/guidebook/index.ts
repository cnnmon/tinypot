/**
 * Guidebook settings control how the AI generates content.
 * 
 * The guidebook has two parts:
 * 1. Rules - individual prompts/preferences (displayed as chips)
 * 2. Settings - sliders and toggles for generation behavior
 */

export interface GuidebookSettings {
  rules: string[]; // Individual prompts, one per line
  creativity: number; // 0-1: 0 = text only, 0.5 = link only, 1 = full freedom (new scenes)
  variableCreation: boolean; // Whether AI can create new variables
  verbosity: 'terse' | 'normal' | 'verbose'; // How much text to generate
}

const DEFAULT_SETTINGS: GuidebookSettings = {
  rules: [],
  creativity: 1, // Full freedom by default
  variableCreation: true,
  verbosity: 'normal',
};

/**
 * Parse guidebook string into settings.
 * Handles both legacy plain text and new JSON format.
 */
export function parseGuidebook(guidebook: string): GuidebookSettings {
  if (!guidebook || !guidebook.trim()) {
    return DEFAULT_SETTINGS;
  }

  // Try to parse as JSON first
  try {
    const parsed = JSON.parse(guidebook);
    if (typeof parsed === 'object' && 'rules' in parsed) {
      return {
        rules: Array.isArray(parsed.rules) ? parsed.rules : [],
        creativity: typeof parsed.creativity === 'number' ? parsed.creativity : 1,
        variableCreation: parsed.variableCreation !== false,
        verbosity: parsed.verbosity || 'normal',
      };
    }
  } catch {
    // Not JSON, treat as legacy plain text
  }

  // Legacy format: plain text, split by newlines
  const rules = guidebook
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return {
    ...DEFAULT_SETTINGS,
    rules,
  };
}

/**
 * Serialize settings back to guidebook string (JSON format).
 */
export function serializeGuidebook(settings: GuidebookSettings): string {
  return JSON.stringify(settings);
}

/**
 * Returns a user-friendly label describing the AI creativity level.
 */
export function getCreativityLabel(creativity: number): string {
  if (creativity <= 0.33) return 'Controlled';
  if (creativity <= 0.66) return 'Limited';
  return 'Unrestricted';
}

/**
 * Build the prompt modifier for the generate API based on guidebook settings.
 * This is the key function that translates settings into LLM instructions.
 * 
 * Creativity levels:
 * - Very Limited (0-0.33): Text only, no gotos, just inline narrative
 * - Pretty Limited (0.34-0.66): Can use existing scenes/variables, but cannot create new ones
 * - Totally Free (0.67-1): Can create new scenes and variables freely
 */
export function buildGuidebookPrompt(settings: GuidebookSettings): {
  constraintsOverride: string | null; // Override for the constraints section
  rulesPrompt: string; // Author preferences section
  styleModifier: string; // Additional style instructions
} {
  const rulesPrompt =
    settings.rules.length > 0
      ? `\nAUTHOR PREFERENCES (follow these closely):\n${settings.rules.map((r) => `- ${r}`).join('\n')}\n`
      : '';

  // Build constraints based on creativity level
  let constraintsOverride: string | null = null;

  if (settings.creativity <= 0.33) {
    // Very Limited: text only, no gotos
    constraintsOverride = `
CONSTRAINTS (VERY LIMITED - Inline text only):
- You can ONLY use TEXT_ONLY responses
- NO scene linking (no goto) or new scene creation allowed
- NO variable changes allowed (no +var or -var)
- Provide ONLY inline narrative text that flows naturally
- The player stays at the current decision point`;
  } else if (settings.creativity <= 0.66) {
    // Pretty Limited: can use existing content, but cannot create new
    constraintsOverride = `
CONSTRAINTS (PRETTY LIMITED - Use existing content only):
- You CANNOT create new scenes (NEW_FORK is NOT allowed)
- You MAY link to existing scenes using LINK_SCENE (goto @SCENE or goto @END)
- You MAY use existing variables (+var, -var) but CANNOT invent new variable names
- Only use variables that already exist in the project
- Work within the existing story structure`;
  }
  // Totally Free (creativity > 0.66): no override, full freedom to create scenes and variables

  // Build style modifier based on verbosity
  // Note: variableCreation setting is now controlled by the creativity slider
  const styleModifiers: string[] = [];

  if (settings.verbosity === 'terse') {
    styleModifiers.push('- Keep responses extremely brief (1-2 short sentences max).');
    styleModifiers.push('- Favor punchy, evocative language over description.');
  } else if (settings.verbosity === 'verbose') {
    styleModifiers.push('- Provide rich, detailed descriptions (3-5 sentences).');
    styleModifiers.push('- Build atmosphere and immerse the player in the world.');
  }

  const styleModifier =
    styleModifiers.length > 0 ? `\nSTYLE INSTRUCTIONS:\n${styleModifiers.join('\n')}\n` : '';

  return {
    constraintsOverride,
    rulesPrompt,
    styleModifier,
  };
}

/**
 * Quick check if guidebook has any meaningful content.
 */
export function hasGuidebookContent(settings: GuidebookSettings): boolean {
  return settings.rules.length > 0 || settings.creativity < 1 || settings.verbosity !== 'normal';
}
