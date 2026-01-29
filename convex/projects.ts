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

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('projects').collect();
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

export const getOrCreate = mutation({
  args: {
    authorId: v.string(),
    name: v.string(),
    description: v.string(),
    script: v.array(v.string()),
    guidebook: v.string(),
  },
  handler: async (ctx, args) => {
    // For now, get the first project or create one
    const existing = await ctx.db.query('projects').first();
    if (existing) return existing;

    const projectId = await ctx.db.insert('projects', args);
    return await ctx.db.get(projectId);
  },
});

export const create = mutation({
  args: {
    authorId: v.string(),
    name: v.string(),
    description: v.string(),
    script: v.array(v.string()),
    guidebook: v.string(),
  },
  handler: async (ctx, args) => {
    const projectId = await ctx.db.insert('projects', args);
    return await ctx.db.get(projectId);
  },
});

export const update = mutation({
  args: {
    projectId: v.id('projects'),
    authorId: v.optional(v.string()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    script: v.optional(v.array(v.string())),
    guidebook: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, ...updates }) => {
    // Filter out undefined values
    const cleanUpdates = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
    await ctx.db.patch(projectId, cleanUpdates);
    return await ctx.db.get(projectId);
  },
});

export const remove = mutation({
  args: { projectId: v.id('projects') },
  handler: async (ctx, { projectId }) => {
    await ctx.db.delete(projectId);
  },
});
