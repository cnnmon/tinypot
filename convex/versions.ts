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
    const versionId = await ctx.db.insert('versions', {
      projectId,
      creator,
      createdAt: Date.now(),
      snapshot,
    });
    return await ctx.db.get(versionId);
  },
});
