bonsai is a "cultivatable" game engine.

<img width="4348" height="1976" alt="sysdesign" src="https://github.com/user-attachments/assets/eb1f98d8-f577-4c76-843d-f7db1137b4f6" />

designed after the metaphor of cultivating a bonsai tree, bonsai is an interactive narrative authoring tool that grows through play, while enabling authors to prune & refine its material.

authors start by "seeding" their game (writing as much as they'd like). the player interacts with the game in natural language, which will either get matched to a similar enough existing option ("run away" = "sneak out") or will lead to a new branch, generated in real-time. branches persist in the editor, which the author can edit and refine asynchronously. the system learns from edit behavior, extracting author preferences to improve its future generations.

uses a custom markup language for interactive narrative authoring.

## auth + ownership

- Google login runs through Convex Auth (`@convex-dev/auth`) with OAuth provider config in `convex/auth.ts`.
- Convex Auth routes are mounted from `convex/http.ts` and proxied via `proxy.ts` at `/api/auth`.
- Required Convex env vars: `SITE_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (+ Convex Auth key material from setup: `JWT_PRIVATE_KEY`, `JWKS`).
- The authenticated user comes from Convex Auth `users` table (`api.users.viewer` + `getAuthUserId` in backend functions).
- Projects now carry `projects.userId` (linked to `users._id`); project mutations enforce owner-only writes.
- `/edit/[projectId]` automatically falls back to view-only when the signed-in account does not own the project.

## sandboxes

- `/sandbox` — line-attribution diff playground. each line carries a source (`base` / `ai` / `human`). adding an AI branch tags new lines green; any human edit (including backspace, line splits, joins) downgrades a touched line to yellow. core logic lives in `lib/attribution/` and is shared with the production editor (`lib/editor/blame.ts` now thin-wraps `replayVersions`).
  - tick-to-tick model: each transaction calls `applyEdit(prev, next, editor)`. unchanged lines keep their source; new/changed lines take the editor's source. exact-match LCS w/ forward+backward DP picks the earliest optimal alignment so duplicates and trailing edits don't drop matches.
  - `replayVersions(versions, currentScript)` reuses the same `applyEdit` chain to derive blame from persisted version history (oldest → newest, plus a trailing 'human' tick for unversioned edits). resolved AI versions can fold into base for the dismiss-highlights workflow.
