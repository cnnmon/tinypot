import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

const SHARE_PREFIX = 's_';

function encodeShareId(projectId: string): string {
  const encoded = btoa(projectId);
  return SHARE_PREFIX + encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const get = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, { projectId }) => {
    return await ctx.db.get(projectId);
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query('projects')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect();
  },
});

// List public projects (not owned by user) with only name and encoded shareId
export const listPublic = query({
  args: { excludeIds: v.array(v.id('projects')) },
  handler: async (ctx, { excludeIds }) => {
    const projects = await ctx.db.query('projects').collect();
    const excludeSet = new Set(excludeIds);

    return projects
      .filter((p) => !excludeSet.has(p._id) && !p.name.includes('Untitled'))
      .map((p) => ({
        name: p.name,
        shareId: encodeShareId(p._id),
      }));
  },
});

export const listByIds = query({
  args: { projectIds: v.array(v.id('projects')) },
  handler: async (ctx, { projectIds }) => {
    const projects = await Promise.all(projectIds.map((id) => ctx.db.get(id)));
    // Filter out null (deleted projects)
    return projects.filter((p) => p !== null);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    script: v.array(v.string()),
    guidebook: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Authentication required');

    const projectId = await ctx.db.insert('projects', {
      userId,
      name: args.name,
      description: args.description,
      script: args.script,
      guidebook: args.guidebook,
    });
    return await ctx.db.get(projectId);
  },
});

export const update = mutation({
  args: {
    projectId: v.id('projects'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    script: v.optional(v.array(v.string())),
    guidebook: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, ...updates }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Authentication required');

    const project = await ctx.db.get(projectId);
    if (!project) return null;

    if (project.userId && project.userId !== userId) {
      throw new Error('Not authorized to edit this project');
    }

    // Filter out undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries({
        ...updates,
        userId: project.userId ?? userId,
      }).filter(([, value]) => value !== undefined),
    );

    if (Object.keys(cleanUpdates).length === 0) return project;

    await ctx.db.patch(projectId, cleanUpdates);
    return await ctx.db.get(projectId);
  },
});

export const remove = mutation({
  args: { projectId: v.id('projects') },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Authentication required');

    const project = await ctx.db.get(projectId);
    if (!project) return;

    if (project.userId && project.userId !== userId) {
      throw new Error('Not authorized to delete this project');
    }

    await ctx.db.delete(projectId);
  },
});
