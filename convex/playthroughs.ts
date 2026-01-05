import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Line validator for playthrough history
const lineValidator = v.object({
  id: v.string(),
  sender: v.union(v.literal("narrator"), v.literal("player"), v.literal("system")),
  text: v.string(),
});

// Schema entry validator
const schemaEntryValidator = v.union(
  v.object({ type: v.literal("narrative"), text: v.string() }),
  v.object({ type: v.literal("scene"), label: v.string() }),
  v.object({ type: v.literal("goto"), target: v.string() }),
  v.object({
    type: v.literal("option"),
    text: v.string(),
    aliases: v.optional(v.array(v.string())),
    then: v.any(),
  })
);

export const get = query({
  args: { playthroughId: v.id("playthroughs") },
  handler: async (ctx, { playthroughId }) => {
    return await ctx.db.get(playthroughId);
  },
});

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("playthroughs")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    lines: v.array(lineValidator),
    snapshot: v.array(schemaEntryValidator),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    const playthroughId = await ctx.db.insert("playthroughs", args);
    return await ctx.db.get(playthroughId);
  },
});

export const update = mutation({
  args: {
    playthroughId: v.id("playthroughs"),
    lines: v.optional(v.array(lineValidator)),
    snapshot: v.optional(v.array(schemaEntryValidator)),
  },
  handler: async (ctx, { playthroughId, ...updates }) => {
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(playthroughId, cleanUpdates);
    return await ctx.db.get(playthroughId);
  },
});

export const remove = mutation({
  args: { playthroughId: v.id("playthroughs") },
  handler: async (ctx, { playthroughId }) => {
    await ctx.db.delete(playthroughId);
  },
});

