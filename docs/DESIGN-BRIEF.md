# Baby Chef Studio — brief for Claude Design

## What it is
A **private, local-first production manager** for AI "Baby Chef" cooking videos. It runs on one person's Mac at `http://localhost:3000` (Next.js 14 + TypeScript + Tailwind + SQLite). It makes **no AI calls**: the user copies prompts out to ChatGPT / Claude / Kling, generates there, then drags the results back in. The app's job is to keep a recipe video organised: recipe → scenes → pictures → video clips → post.

**Who uses it:** one non-technical creator, often on a laptop, sometimes on a phone. She wants big, obvious buttons, plain words, as much auto-filled as possible (always editable), and nothing overwhelming.

## Design rules she has asked for (please keep)
- **Not overwhelming, not busy.** Straightforward, large buttons, one thing at a time, different aspects grouped in different parts of the screen.
- Plain wording ("Picture", "Scene", "Video clip") — technical names stay in code only.
- Reference/extra info is **collapsible** (references were "too distracting" when scrolling).
- Everything that can auto-fill does; every auto value can be changed by hand.
- Never lose data. Nothing destructive without a clear confirm.
- Look today: white background, soft lavender-grey sunken areas (#F4F3F7), ink #1E1D22, accents blue #3E6290, sage #4C6B52, pink #9A4A60, purple #6A4E98, gold for "gold standard". Rounded corners (14–18px), gentle shadows. Tokens are in `tailwind.config.ts`; components in `components/`.

## Main areas (routes)
| Area | Route | What it does |
|---|---|---|
| Home / Projects | `/`, `/projects` | List of recipe videos, "new recipe video" (fill from pasted text) |
| Baby Chefs | `/babychefs` | Character profiles + master reference gallery (baby, kitchen, outfit), Gold Standard marks |
| Overview | `/projects/[slug]` | "What do I do next?" with one big button |
| Start to Finish | `/start` | Whole project in order with Done / In progress / Not started |
| Missing Info | `/questions` | Questions still open, COPY ALL button |
| Recipe | `/recipe`, `/recipe/reparse` | Pasted recipe parsed into ingredients + method sections, re-parse |
| Scenes & Pictures | `/story` | Scenes with their pictures (list or grid), drag to reorder, insert scene/picture, red flag |
| Images to Generate | `/generate` | One card per picture: ChatGPT prompt, copy, open ChatGPT, upload/drop result, approve, AI references (collapsed) |
| Picture List | `/images` | Every picture as a card (preview, flag, upload, arrange, references) |
| **NEED TO FIX** | `/fix` | Flagged pictures/scenes to resolve (see below) — **page being redesigned** |
| Video Clips | `/kling`, `/kling/[id]` | Per scene: gathered approved pictures, video prompt, drop the finished video |
| Post Video | `/short`, `/publishing` | Short version timeline, YouTube/Shorts/Facebook/Instagram/TikTok text |
| More | `/more` | Files, notes, continuity, overrides, references, prompts, import |
| Settings | `/settings` | Storage, automation (cloud reference links), update/quit controls, Production Bible |

## Features that exist now
- **Fill from text** on every importer with FORMAT HELP (copy ChatGPT instructions, blank template, example, copy everything).
- **Recipe parser** (deterministic): ingredients as records, method sections, suspicious-result warning.
- **Auto image plan** per scene + **auto prompt writer** in the Baby Chef ChatGPT style, including scene-aware "negative states" (what must NOT appear).
- **Automatic names:** pictures `WAT-S12-IMG016_lightly-whisk-eggs_v1.png`, clips `WAT-S12-CLIP03_v2.mp4` (3-letter project code, editable). Inserted scenes show 4A/4B; stable codes (SC02, IMG-021) never change.
- **Uploads** go to the right folder with the right name automatically — by button **or drag-and-drop** (pictures on any picture card; videos on clip pages).
- **AI generation references** per picture: baby / kitchen / outfit masters + nearest approved picture BEFORE and AFTER, manual change, ZIP on demand, signed share links for cloud ChatGPT/Cowork (optional tunnel).
- **Arrange:** move picture up/down, to another scene, swap two pictures.
- **Red flag** on pictures and scenes (top-right of the preview) → shows in NEED TO FIX with a count badge.
- **Video clips:** each clip shows which approved pictures it was built from and their file names; attempts recorded; fix-this-video prompt.
- Prompt versions, Production Bible (27 editable rule sections), Prompt Queue, corrections library, search, backups.
- **Mac helpers:** icon launcher (.app), in-app Update / Quit (Mac-only, unverified), installer script.

## NEED TO FIX (new design just built — please improve the look)
One flagged picture at a time, three big steps with a stepper at the top:
1. **References** — grouped thumbnails (Suggested, Reference photos & ingredients, Approved pictures [collapsed]); tick to select; each ticked one gets a text box "What is in this image / what kind of reference is it?"; two big buttons: *Add as a list at the end* or *Add into the prompt text*.
2. **Prompt** — the normal ChatGPT prompt (autosaves), big COPY PROMPT and OPEN CHATGPT + COPY PROMPT buttons.
3. **Final image** — big drop zone/upload, then **FIXED — APPROVE & NEXT FLAGGED** which approves, removes the flag and returns to the list of all flagged pictures to choose the next one.
The default view is a grid of all flagged pictures ("Pick one to fix").

## Known gaps / wishes
- NEED TO FIX look and feel is v1 — she will refine after seeing it.
- Phone layout works but has had the least design attention.
- Wanted: friendlier empty states, calmer Images-to-Generate cards, clearer progress across the whole video.
- Unverified on her Mac: .app launcher, in-app Update, tunnel for cloud references.

## Where to look in the code
`app/projects/[slug]/**/page.tsx` (pages), `components/` (UI), `lib/` (logic; `lib/actions/` = server actions), `tailwind.config.ts` (tokens), `README.md` (full feature list).
