import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("guidebookChanges")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    branchId: v.optional(v.id("branches")),
    action: v.union(v.literal("add"), v.literal("update"), v.literal("delete")),
    rule: v.string(),
    previousRule: v.optional(v.string()),
    source: v.union(v.literal("metalearning"), v.literal("manual")),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("guidebookChanges", {
      ...args,
      createdAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

// Record multiple changes at once (for manual bulk edits)
export const createMany = mutation({
  args: {
    projectId: v.id("projects"),
    changes: v.array(
      v.object({
        action: v.union(v.literal("add"), v.literal("update"), v.literal("delete")),
        rule: v.string(),
        previousRule: v.optional(v.string()),
      })
    ),
    source: v.union(v.literal("metalearning"), v.literal("manual")),
  },
  handler: async (ctx, { projectId, changes, source }) => {
    const now = Date.now();
    for (const change of changes) {
      await ctx.db.insert("guidebookChanges", {
        projectId,
        action: change.action,
        rule: change.rule,
        previousRule: change.previousRule,
        source,
        createdAt: now,
      });
    }
  },
});

// Get stats for analytics
export const getStats = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const changes = await ctx.db
      .query("guidebookChanges")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    const fromMetalearning = changes.filter((c) => c.source === "metalearning");
    const manualEdits = changes.filter((c) => c.source === "manual");

    return {
      totalChanges: changes.length,
      rulesFromMetalearning: fromMetalearning.filter((c) => c.action === "add").length,
      rulesUpdatedByMetalearning: fromMetalearning.filter((c) => c.action === "update").length,
      manualAdditions: manualEdits.filter((c) => c.action === "add").length,
      manualUpdates: manualEdits.filter((c) => c.action === "update").length,
      manualDeletions: manualEdits.filter((c) => c.action === "delete").length,
    };
  },
});

