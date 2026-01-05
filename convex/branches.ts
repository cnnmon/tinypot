import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("branches")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

export const get = query({
  args: { branchId: v.id("branches") },
  handler: async (ctx, { branchId }) => {
    return await ctx.db.get(branchId);
  },
});

export const getByPlaythrough = query({
  args: { playthroughId: v.string() },
  handler: async (ctx, { playthroughId }) => {
    return await ctx.db
      .query("branches")
      .withIndex("by_playthrough", (q) => q.eq("playthroughId", playthroughId))
      .collect();
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    playthroughId: v.string(),
    title: v.string(),
    sceneIds: v.array(v.string()),
    base: v.any(),
    generated: v.any(),
    authored: v.optional(v.any()),
    baseScript: v.optional(v.array(v.string())),
    approved: v.optional(v.boolean()),
    metalearning: v.optional(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    const branchId = await ctx.db.insert("branches", args);
    return await ctx.db.get(branchId);
  },
});

export const update = mutation({
  args: {
    branchId: v.id("branches"),
    title: v.optional(v.string()),
    sceneIds: v.optional(v.array(v.string())),
    base: v.optional(v.any()),
    generated: v.optional(v.any()),
    authored: v.optional(v.any()),
    approved: v.optional(v.boolean()),
    metalearning: v.optional(v.string()),
  },
  handler: async (ctx, { branchId, ...updates }) => {
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(branchId, cleanUpdates);
    return await ctx.db.get(branchId);
  },
});

export const remove = mutation({
  args: { branchId: v.id("branches") },
  handler: async (ctx, { branchId }) => {
    await ctx.db.delete(branchId);
  },
});

export const saveAll = mutation({
  args: {
    projectId: v.id("projects"),
    branches: v.array(v.any()),
  },
  handler: async (ctx, { projectId, branches }) => {
    // Delete existing branches for this project
    const existing = await ctx.db
      .query("branches")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    for (const branch of existing) {
      await ctx.db.delete(branch._id);
    }

    // Insert new branches
    for (const branch of branches) {
      await ctx.db.insert("branches", {
        projectId,
        playthroughId: branch.playthroughId,
        title: branch.title,
        sceneIds: branch.sceneIds,
        base: branch.base,
        generated: branch.generated,
        authored: branch.authored,
        approved: branch.approved,
        metalearning: branch.metalearning,
        createdAt: branch.createdAt,
      });
    }
  },
});

