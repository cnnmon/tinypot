import { Entity } from '@/types/entities';
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

export const list = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query('versions')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .order('desc')
      .collect();
  },
});

export const create = mutation({
  args: {
    projectId: v.id('projects'),
    creator: v.union(v.literal(Entity.AUTHOR), v.literal(Entity.SYSTEM)),
    snapshot: v.object({
      script: v.array(v.string()),
      guidebook: v.string(),
    }),
  },
  handler: async (ctx, { projectId, creator, snapshot }) => {
    const now = Date.now();
    const versionId = await ctx.db.insert('versions', {
      projectId,
      creator,
      createdAt: now,
      updatedAt: now,
      snapshot,
    });
    return await ctx.db.get(versionId);
  },
});

export const update = mutation({
  args: {
    versionId: v.id('versions'),
    snapshot: v.object({
      script: v.array(v.string()),
      guidebook: v.string(),
    }),
  },
  handler: async (ctx, { versionId, snapshot }) => {
    await ctx.db.patch(versionId, {
      snapshot,
      updatedAt: Date.now(),
    });
    return await ctx.db.get(versionId);
  },
});

export const remove = mutation({
  args: { versionId: v.id('versions') },
  handler: async (ctx, { versionId }) => {
    await ctx.db.delete(versionId);
  },
});

export const resolve = mutation({
  args: { versionId: v.id('versions') },
  handler: async (ctx, { versionId }) => {
    await ctx.db.patch(versionId, { resolved: true });
  },
});

export const resolveAll = mutation({
  args: { projectId: v.id('projects') },
  handler: async (ctx, { projectId }) => {
    const versions = await ctx.db
      .query('versions')
      .withIndex('by_project', (q) => q.eq('projectId', projectId))
      .collect();
    
    for (const version of versions) {
      if (!version.resolved) {
        await ctx.db.patch(version._id, { resolved: true });
      }
    }
  },
});
