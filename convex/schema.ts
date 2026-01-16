import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

// Schema entry validator (recursive structure flattened with v.any() for `then`)
const schemaEntryValidator = v.union(
  v.object({ type: v.literal('narrative'), text: v.string() }),
  v.object({ type: v.literal('scene'), label: v.string() }),
  v.object({ type: v.literal('goto'), target: v.string() }),
  v.object({
    type: v.literal('option'),
    text: v.string(),
    aliases: v.optional(v.array(v.string())),
    then: v.any(), // Recursive SchemaEntry[] - use v.any() to avoid circular definition
  }),
);

// Line validator for playthrough history
const lineValidator = v.object({
  id: v.string(),
  sender: v.union(v.literal('narrator'), v.literal('player'), v.literal('system')),
  text: v.string(),
});

export default defineSchema({
  projects: defineTable({
    authorId: v.string(),
    name: v.string(),
    description: v.string(),
    script: v.array(v.string()),
    guidebook: v.string(),
  }),

  playthroughs: defineTable({
    projectId: v.id('projects'),
    lines: v.array(lineValidator),
    snapshot: v.array(schemaEntryValidator),
    createdAt: v.number(),
  }).index('by_project', ['projectId']),

  branches: defineTable({
    projectId: v.id('projects'),
    playthroughId: v.string(), // Using string for now since playthroughs may be ephemeral
    title: v.string(),
    sceneIds: v.array(v.string()),
    base: v.any(), // Record<string, SchemaEntry[]>
    generated: v.any(), // Record<string, SchemaEntry[]>
    authored: v.optional(v.any()), // Record<string, SchemaEntry[]>
    baseScript: v.optional(v.array(v.string())), // Original script for easy discard
    approved: v.optional(v.boolean()),
    metalearning: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_project', ['projectId'])
    .index('by_playthrough', ['playthroughId']),

  // Tracks all guidebook changes for analytics
  guidebookChanges: defineTable({
    projectId: v.id('projects'),
    branchId: v.optional(v.id('branches')), // null if manual edit
    action: v.union(v.literal('add'), v.literal('update'), v.literal('delete')),
    rule: v.string(),
    previousRule: v.optional(v.string()), // for updates
    source: v.union(v.literal('metalearning'), v.literal('manual')),
    createdAt: v.number(),
  }).index('by_project', ['projectId']),
});
