# Scene Generation Design: When Should AI Create New Scenes?

## Current Behavior

By default, the AI can create new scenes. You can control this per-scene with inline syntax:

```
@SCENE [allows: new]    // AI can create new scenes (default)
@SCENE [allows: link]   // AI can only link to existing scenes
@SCENE [allows: text]   // AI can only add flavor text, no scene changes
```

## The Core Tradeoff

| **Allow New Scenes** | **Disallow New Scenes** |
|----------------------|-------------------------|
| Emergent, open-world feel | Authored, controlled narrative |
| World grows from player choices | World is pre-defined |
| Less predictable endings | Reliable story arcs |
| AI as co-author | AI as fill-in-the-gaps helper |

## Your Life Sim Case

Your current structure uses **time-based progression** (turn counter) rather than **location-based progression** (scenes). This is interesting because:

```
when turn >= 3 → END
when turn >= 2 → "You're older."
when turn >= 1 → "You're young."
```

The preamble handles life stages, but all gameplay happens in `@BEGIN`. The question is: **should player choices branch into new scenes?**

### Option A: Single Scene, AI-Flavored (No New Scenes)

```
@BEGIN [allows: text]
What do you want to do?
```

- Player types "become a programmer" → AI responds with flavor text, stays in @BEGIN
- All variety comes from **variables** and **when blocks**, not new scenes
- Tight control, but can feel repetitive

### Option B: Player Choices Create Branches (Allow New Scenes)

```
@BEGIN
What do you want to do?
```

- Player types "become a programmer" → AI creates `@TECH_CAREER` scene
- World expands based on player intent
- More emergent, but you lose control over ending

### Option C: Hybrid (Author Seeds, AI Extends)

```
@BEGIN
What do you want to do?
if go into tech
    +tech
    goto @TECH_LIFE
if go into arts
    +arts  
    goto @ARTS_LIFE

@TECH_LIFE [allows: new]
You're in the tech world now.

@ARTS_LIFE [allows: new]
You're pursuing your creative passions.
```

- You define the **major life paths**
- AI can extend within each path
- Balance of control and emergence

## Recommendation for Collaborative Vibe-Game

Given your goal (many people collaboratively building one game), I'd suggest:

### 1. **Keep `allows: new` as default** (current behavior)
This lets players expand the world naturally. Someone types "go to the coffee shop" → AI creates `@COFFEE_SHOP`.

### 2. **Use explicit `[allows: text]` for "hub" scenes**
Your main scenes that should funnel players:
```
@BEGIN [allows: text]
What do you want to do?
```
This prevents the AI from creating scenes from @BEGIN, but once players enter a branch, it can expand.

### 3. **Trust the turn counter for endings**
Your preamble `when turn >= 3 → goto @END` ensures the game always ends, regardless of where players wander.

### 4. **Add `[allows: link]` for late-game scenes**
If you want to close off new branches near the end:
```
@RETIREMENT [allows: link]
You reflect on your life choices.
```
AI can only link to existing scenes, creating a "closing" feel.

## Should This Be a Setting?

**Not recommended as a global setting.** The per-scene `[allows: ...]` gives you fine-grained control where you need it. A global toggle would be too blunt—you want open exploration early, constrained endings late.

## Summary

For your life sim:
1. Seed 2-3 major life path scenes (`@TECH`, `@ARTS`, `@FAMILY`, etc.)
2. Use `[allows: text]` on `@BEGIN` to force explicit branches
3. Let AI extend within each path (`allows: new` default)
4. Trust the turn counter preamble for reliable endings

This gives you **authored structure** (major paths you define) with **emergent depth** (AI fills in the details).
