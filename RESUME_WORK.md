# RESUME_WORK.md — Baby Chef Studio

_Last updated at the final verified checkpoint. Nothing is mid-flight._

## Status: all specified work is implemented and verified

Implemented (see README.md for the user-facing description):
- Original 3-part specification, Production Brain add-on (parts 1 & 2), local-first storage clarification.
- Design handoff "4a · Colour-coded studio" (all six approved screen files): shell, 3D gradient buttons, Image Detail
  workspace, Review/Redo, Kling workspace, Prompt Builder + Production Bible, Dashboard/Queue/Publishing/Files,
  Baby Chef profile + gallery, Scenes + Food State, Short Version timeline, iPhone layouts (sticky action bars).
- Prompt Builder (`lib/prompt-builder.ts`): all 12 builders verified by the e2e suite (context blocks, bible rules,
  chef/recipe/ingredient/product/previous-frame/correction context, edit-safe rebuild, saved versions, paste-back).

## Last successful verification
- `npx tsc --noEmit`: clean · `npx next lint`: clean · `npx next build`: passes
- `node scripts/e2e.mjs` against a running production server: **97/97 passed**
  (full workflow new project → publishing, all builders, local file layout, reorder/batch/lock, 40 screens × 2 widths
  with no horizontal overflow, no console errors)
- Empty-database first run: every top-level page renders its empty state (HTTP 200).
- `next dev` smoke test: 29 pages, zero console errors/warnings.

## Database / migrations
SQLite via Prisma `db push` (no migration files). All changes were additive; schema is in `prisma/schema.prisma`.
Database file: `prisma/dev.db` (git-ignored). Seed: `npm run db:seed` (refuses to run if projects exist).

## Known limitations (documented in README)
No AI/API calls, no social posting, no auto image analysis; HEIC photos unsupported (use JPG/PNG/WebP);
Show in Finder / Import from Downloads only work on macOS and were not exercised on a Mac in the sandbox;
Google Fonts load from the network (fallback fonts offline); changing the storage root does not move existing files.

## Possible next tasks (optional, not required by the spec)
- Duplicate Production Bible version; drag-and-drop for scenes/short moments (↑/↓ buttons exist).
- Hosted DB/storage, auth, optional AI APIs (architecture leaves room: `lib/storage.ts`, `lib/prompt-builder.ts`).

## Commands to resume / re-verify
```bash
npm install && cp -n .env.example .env && npx prisma db push && npm run db:seed
npx tsc --noEmit && npx next lint
export STORAGE_DIR=/tmp/bcs-test-storage
npx next build && (npx next start -p 3100 &) && sleep 5
node scripts/e2e.mjs        # needs: BASE=http://localhost:3100 (default) and STORAGE_DIR set as above
```
