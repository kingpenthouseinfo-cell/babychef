# Baby Chef Studio

A private, **local-first production manager** for AI-generated Baby Chef cooking videos.

It organizes everything around the tools you already use — ChatGPT, Claude, Kling, CapCut — and **never calls an AI service itself**. You copy prompts out, generate externally, and bring the results back. Baby Chef Studio keeps the recipe, ingredients, product references, scripts, scenes, planned images, prompts, attempts, approvals, redos, Kling clips, short-form plan and publishing copy in one place — and stores every image/video as a normal, human-readable file on your Mac.

## What's inside

- **Baby Chefs**: reusable character profiles + master reference gallery (Gold Standard marks), corrections library ("Don't Do This").
- **Projects**: recipe (versioned), structured ingredients with brand/product reference photos (Package-critical / Texture-critical / Optional), continuity bible, script versions, scenes with Before/During/After food states, food-progression view.
- **Planned images** (globally numbered `IMG-001…`): Full prompt + Continuation prompt (autosave + versions), ordered reference checklist, Previous Approved Frame, dependencies, add result → review → approve / redo (attempts and corrections are never overwritten).
- **Prompt Queue**: "Copy next prompt", reference checklist, waiting state.
- **Production Brain**: 27 editable Production Bible rule sections (versioned) + Baby Chef profile + project overrides → 12 prompt builders (production plan, script, scenes, image plan, full/continuation image prompt writers, redo, continuity review, Kling grouping, final Kling prompt, Kling redo) with a context preview, edit-safe rebuild, saved versions, paste-back of the AI's answer, and import of scenes from text.
- **Kling clips**: ordered `@image` references (drag to reorder), collapsible prompt sections, credit-protecting pre-flight, generation records.
- **Short Version** (timeline + CapCut notes), **Publishing** (YouTube / Shorts / Facebook / Instagram / TikTok prompts, pasted results, selected copy, checklist), **Files**, **Settings**, search, JSON / CSV / ZIP export.

## Everyday workflow (plain wording)

Open a **Recipe Video** and the first thing you see is **What do I do next?** with one big button. Tabs: Overview · **Start to Finish** (the whole project in order, with Done / In progress / Not started / Needs fixing / Waiting) · **Missing Info** (plain questions you answer in place; blanks like `[temperature]` and conflicting times become questions automatically) · Recipe · Ingredients (quick add, plus one panel to give any ingredient its brand, label details and photo) · **Scenes & Pictures** (a checklist/storyboard where you can **+ ADD PICTURE HERE**, **+ QUICK ADD**, **+ ADD SCENE HERE**, move up/down, duplicate, split a scene) · Video Clips · Post Video · More.

* Visible numbers ("Picture 5") update when you insert or move things; the stable IDs (`SC02`, `IMG-021`, used in file names) never change.
* **Fill from text** (New Recipe Video, Overview, Recipe, Ingredients, Scenes & Pictures): paste labelled text, check it, then fill in. Nothing is saved until you confirm; existing answers are kept unless you choose Replace/Merge.
* Technical names (Planned Image, Prompt Queue, Production Brain…) remain in code and the database only.

## Technology

Next.js 14 (App Router) · TypeScript · React · Tailwind CSS · Prisma · SQLite · local file storage (behind a small `StorageProvider` interface). No auth, no billing, no cloud, no AI SDKs.

## Install & run (macOS / Linux, Node 20+)

```bash
npm install                 # also generates the Prisma client
cp .env.example .env        # DATABASE_URL="file:./dev.db"
npx prisma db push          # creates the SQLite database (prisma/dev.db)
npm run db:seed             # OPTIONAL: demo project "Jamaican Beef Patties" with placeholder images
npm run dev                 # http://localhost:3000
```

Production build: `npm run build && npm start`.
Other scripts: `npm run typecheck`, `npm run lint`, `npm run db:reset` (⚠ wipes the database, then re-seeds).

Smoke test (needs a running server): `BASE=http://localhost:3000 STORAGE_DIR=/some/test/dir node scripts/e2e.mjs`.

## Where your files and data live

| What | Where |
|---|---|
| Metadata, prompts, statuses, versions, file paths | SQLite database `prisma/dev.db` |
| Images, product photos, videos, exported text | **Storage root** — default `~/Documents/Baby Chef Studio/` (change it in **Settings → Storage**, or set `STORAGE_DIR`) |
| Thumbnail cache (safe to delete) | `.cache/thumbs/` inside the app folder |

Folder layout (readable without the app):

```
Baby Chef Studio/
  00 Baby Chefs/<Chef name>/References/{Baby,Kitchen,Food}/REF-BABY-001_master-face_….png
  Jamaican Beef Patties/
    01 References/{Baby,Kitchen,Products,Food,Actions,Corrections}/REF-PRODUCT-001_coconut-milk_example-brand_front-label.png
    02 Images/   jamaican-beef-patties_SC12_IMG-024_v2.png
    03 Redos/    superseded / rejected attempts
    04 Kling/    generated videos (optional)
    05 Prompts/  scripts, image prompts, Kling prompts (.txt)
    06 Publishing/
```

* **Add result** copies a file you choose (or the newest image in `~/Downloads`, or one you drag onto the page) into `02 Images` under an organized name. Files are never overwritten (`_v2`, `_dup2`).
* A reference photo is stored **once** and *linked* to every image that uses it — it is never copied per image.
* **Expected result filename**: every planned image shows the exact filename its result should have (`<slug>_SC12_IMG-024_v1.png`, next version after each attempt). Image prompts you copy end with a *FILE ORGANIZATION* block telling ChatGPT to use it (ChatGPT may ignore this — then use Add result or **Unmatched Files**).
* **Folder watcher** (Settings → toggle): while the app runs it scans `<Project>/02 Images/` every few seconds (and on startup). A file whose name carries the project slug, scene, image and version, and agrees with your planned image, is indexed **in place** as a new attempt in Review. Anything else (bad name, duplicate version, unknown image) goes to **Unmatched Files**, where you assign it (it is then renamed/moved) or ignore it. Files are never guessed at, copied, deleted or overwritten; partial downloads (`.crdownload`, `.tmp`, …) are skipped.
* **Show in Finder** (macOS) reveals a file via the local server; elsewhere the path is copied.
* **Files → "Write text files to project folder"** saves scripts, prompts, scenes and publishing copy as `.txt` next to your images so the folder is understandable even without the database.

### Backing up

Back up **two things**: the storage root folder (`~/Documents/Baby Chef Studio/`) **and** `prisma/dev.db`. Copy both while the app is stopped (or use Time Machine). To move to a new Mac, copy both and keep the same relative layout; paths in the database are relative to the storage root, so you can change the root in Settings afterwards. Backups are not automatic.

## Version 1 limitations

Baby Chef Studio does **not**: generate images or videos; call the ChatGPT, Claude, Gemini or Kling APIs; control browser tabs; post to social media; edit video; or analyze images automatically. "Open ChatGPT / Claude / Kling" only opens a link in a new tab. It stores no passwords. It is single-user with no login — run it only on your own computer. Changing the storage root does not move existing files. Scene import from pasted text uses a conservative parser and previews before it saves. Image pickers accept JPG, PNG, WebP and GIF; **HEIC/HEIF iPhone photos are not supported directly** — pick them from Photos (Safari converts them) or export as JPG first.

## Architecture notes (for future versions)

Server actions in `lib/actions/*` write; `lib/prompt-builder.ts` is the Prompt Builder service (context blocks + editable task templates in `lib/task-templates.ts`); `lib/storage.ts` / `lib/files.ts` are the only places that touch the file system; `prisma/schema.prisma` is the data model. Likely future work: cloud/hosted storage and database, authentication, optional AI APIs, automatic image metadata/analysis, team collaboration.
