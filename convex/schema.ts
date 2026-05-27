import { Entity } from '@/types/entities';
import { authTables } from '@convex-dev/auth/server';
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
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // App-specific mirrored field for backwards compatibility with current UI.
    imageUrl: v.optional(v.string()),
    updatedAt: v.optional(v.number()),
  }).index('email', ['email']),

  projects: defineTable({
    authorId: v.optional(v.string()), // Legacy field (kept for backwards compatibility)
    userId: v.optional(v.id('users')),
    name: v.string(),
    description: v.string(),
    script: v.array(v.string()),
    guidebook: v.string(),
  }).index('by_userId', ['userId']),

  playthroughs: defineTable({
    projectId: v.id('projects'),
    lines: v.array(lineValidator),
    snapshot: v.array(schemaEntryValidator),
    createdAt: v.number(),
  }).index('by_project', ['projectId']),

  versions: defineTable({
    // Checkpoints
    projectId: v.id('projects'),
    creator: v.union(v.literal(Entity.AUTHOR), v.literal(Entity.SYSTEM)),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()), // When the version was last updated (for coalescing)
    resolved: v.optional(v.boolean()), // Whether AI changes have been reviewed/dismissed
    snapshot: v.object({
      script: v.array(v.string()),
      guidebook: v.string(),
    }),
  }).index('by_project', ['projectId']),
});
