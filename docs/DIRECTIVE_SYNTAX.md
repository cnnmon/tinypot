# Directive Syntax: Images & Variables

## Overview

This document scopes out adding **directives** - special bracketed syntax for non-narrative content like images and variables.

**Proposed syntax:** `[key="value"]` or `[key=value]`

---

## Part 1: Images

### Syntax

```
[image="https://example.com/photo.jpg"]
```

### Implementation

**Complexity: Low** - Straightforward extension of existing patterns.

#### 1. Schema Changes (`types/schema.ts`)

```typescript
export enum EntryType {
  NARRATIVE = 'narrative',
  JUMP = 'goto',
  OPTION = 'option',
  SCENE = 'scene',
  IMAGE = 'image',  // NEW
}

export interface ImageEntry {
  type: EntryType.IMAGE;
  url: string;
}

export type SchemaEntry = NarrativeEntry | OptionEntry | JumpEntry | SceneEntry | ImageEntry;
```

#### 2. Parser Changes (`lib/project/parser/index.ts`)

Add detection before the narrative fallback:

```typescript
// Image directive: [image="url"]
const imageMatch = trimmed.match(/^\[image="(.+?)"\]$/);
if (imageMatch) {
  const url = imageMatch[1];
  const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const isValidImage = validExtensions.some(ext => 
    url.toLowerCase().endsWith(ext) || url.includes(ext + '?')
  );
  
  if (isValidImage) {
    schema.push({ type: EntryType.IMAGE, url });
  } else {
    // Invalid image - treat as narrative with warning
    schema.push({ type: EntryType.NARRATIVE, text: `[Invalid image: ${url}]` });
  }
  i++;
  continue;
}
```

#### 3. Step Function Changes (`lib/player/utils/step.ts`)

Update `buildScenePositions` to handle images like narratives:

```typescript
// In buildScenePositions:
if (entry.type === EntryType.NARRATIVE || entry.type === EntryType.IMAGE) {
  if (pendingOptions) {
    positions.push({ type: 'wait' });
    pendingOptions = false;
  }
  positions.push({
    type: entry.type === EntryType.IMAGE ? 'image' : 'narrative',
    narrativeIdx: positions.filter((p) => p.type === 'narrative' || p.type === 'image').length,
    text: entry.type === EntryType.IMAGE ? entry.url : entry.text,
  });
}
```

#### 4. Player Component Changes (`components/Player/index.tsx`)

Extend the line rendering:

```tsx
{lines.map((line, i) => {
  const isPlayer = line.sender === Sender.PLAYER;
  const isImage = line.type === 'image';  // Add type to Line
  
  if (isImage) {
    return (
      <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <img src={line.text} alt="" className="max-w-full rounded-lg" />
      </motion.div>
    );
  }
  
  return (
    <motion.p key={i} /* ... existing code ... */}>
      {line.text}
    </motion.p>
  );
})}
```

#### 5. Playthrough Types (`types/playthrough.ts`)

```typescript
export interface Line {
  id: string;
  sender: Sender;
  text: string;
  type?: 'text' | 'image';  // NEW - optional for backwards compat
}
```

### Files to Modify

| File | Change |
|------|--------|
| `types/schema.ts` | Add `ImageEntry` type |
| `types/playthrough.ts` | Add `type` field to `Line` |
| `lib/project/parser/index.ts` | Parse `[image="url"]` syntax |
| `lib/player/utils/step.ts` | Handle IMAGE entries |
| `components/Player/index.tsx` | Render images |

**Estimated effort:** ~1-2 hours

---

## Part 2: Variables

### Syntax

```
[HEALTH=2]           # Number
[NAME="Alice"]       # String
[HAS_KEY=true]       # Boolean

# Usage in text:
You have {HEALTH} health remaining.
Hello, {NAME}!
```

### Implementation

**Complexity: Medium** - Requires state management and text interpolation.

#### 1. Schema Changes

```typescript
export enum EntryType {
  // ... existing
  SET_VAR = 'set_var',  // NEW
}

export interface SetVarEntry {
  type: EntryType.SET_VAR;
  name: string;
  value: string | number | boolean;
}
```

#### 2. Variable State Management

**Option A: In Playthrough State** (recommended)

```typescript
// types/playthrough.ts
export interface Playthrough {
  // ... existing fields
  variables: Record<string, string | number | boolean>;
}

// lib/player/index.ts - in usePlayer hook
const [variables, setVariables] = useState<Record<string, VarValue>>({});
```

**Option B: Separate Context**

Create a `VariableContext` for global access. More flexible but adds complexity.

#### 3. Parser Changes

```typescript
// Variable set: [NAME="value"] or [NAME=123]
const varMatch = trimmed.match(/^\[([A-Z_][A-Z0-9_]*)=(.+)\]$/i);
if (varMatch) {
  const [, name, rawValue] = varMatch;
  let value: string | number | boolean;
  
  // Parse value type
  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    value = rawValue.slice(1, -1); // String
  } else if (rawValue === 'true' || rawValue === 'false') {
    value = rawValue === 'true';  // Boolean
  } else if (!isNaN(Number(rawValue))) {
    value = Number(rawValue);     // Number
  } else {
    value = rawValue;             // Fallback to string
  }
  
  schema.push({ type: EntryType.SET_VAR, name: name.toUpperCase(), value });
  i++;
  continue;
}
```

#### 4. Step Function Changes

SET_VAR entries should be "silent" - they don't produce lines but update state:

```typescript
// In step() or a new executeEntry():
if (entry.type === EntryType.SET_VAR) {
  // Return a special action to update variables
  return {
    type: 'set_var',
    varName: entry.name,
    varValue: entry.value,
  };
}
```

#### 5. Text Interpolation

```typescript
// lib/player/utils/interpolate.ts
export function interpolateVariables(
  text: string,
  variables: Record<string, VarValue>
): string {
  return text.replace(/\{([A-Z_][A-Z0-9_]*)\}/gi, (match, name) => {
    const value = variables[name.toUpperCase()];
    return value !== undefined ? String(value) : match;
  });
}
```

Apply in `addLine()` before adding to playthrough:

```typescript
const interpolatedText = interpolateVariables(newLine.text, variables);
```

#### 6. Conditional Logic (Future Extension)

Once variables exist, conditionals become natural:

```
[if HEALTH > 0]
  You continue the journey.
[else]
  Game over.
[endif]
```

This would require:
- New entry types: `IF`, `ELSE`, `ENDIF`
- Expression parser for conditions
- Branch execution logic in step()

**Estimated effort for conditionals:** Additional 4-6 hours

### Files to Modify for Variables

| File | Change |
|------|--------|
| `types/schema.ts` | Add `SetVarEntry` type |
| `types/playthrough.ts` | Add `variables` to Playthrough |
| `lib/project/parser/index.ts` | Parse `[NAME=value]` syntax |
| `lib/player/utils/step.ts` | Handle SET_VAR (silent execution) |
| `lib/player/index.ts` | Manage variable state |
| `lib/player/utils/interpolate.ts` | NEW - text interpolation |
| `components/Player/index.tsx` | No direct changes (interpolation happens before) |

**Estimated effort:** ~3-4 hours

---

## Shared Directive Parsing

Both features use `[...]` syntax. A unified approach:

```typescript
// lib/project/parser/directives.ts
export type Directive = 
  | { type: 'image'; url: string }
  | { type: 'set_var'; name: string; value: VarValue }
  | null;

export function parseDirective(line: string): Directive {
  const trimmed = line.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null;
  
  const inner = trimmed.slice(1, -1);
  
  // [image="url"]
  const imageMatch = inner.match(/^image="(.+)"$/i);
  if (imageMatch) {
    return { type: 'image', url: imageMatch[1] };
  }
  
  // [NAME=value]
  const varMatch = inner.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/i);
  if (varMatch) {
    const [, name, rawValue] = varMatch;
    return { type: 'set_var', name, value: parseValue(rawValue) };
  }
  
  return null;
}
```

---

## Recommendation

**Start with images** - it's a clean, isolated feature that:
1. Validates the directive syntax pattern
2. Extends the schema/step/player pipeline
3. Doesn't require state management

Then **add variables** using the same patterns, with the additional state layer.

---

## Summary

| Feature | Complexity | Dependencies | Effort |
|---------|------------|--------------|--------|
| Images | Low | None | 1-2 hrs |
| Variables | Medium | Images (pattern) | 3-4 hrs |
| Conditionals | High | Variables | 4-6 hrs |

The `[key=value]` directive syntax is intentionally designed to extend cleanly to both features and future additions.

