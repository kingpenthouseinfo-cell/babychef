# Claude Design brief — "Image Prompts" and "Video Prompts" pages (Baby Chef Studio)

Paste everything below into Claude Design. The pages are already built and working; I need the **look** (CSS). Send back one CSS file that replaces `app/prompt-pages.css` — no other file needs to change.

## What the app is (30 seconds)
Baby Chef Studio is a private Mac app (Next.js + Tailwind) for making AI Baby Chef cooking videos. The creator copies prompts into ChatGPT (pictures) and Kling (videos), then brings the results back. She is not technical: she wants **big, obvious buttons, plain words, calm and not busy, one thing per row.**

Existing look to stay friendly with: white background, soft lavender-grey (#F4F3F7) areas, ink #1E1D22, blue #3E6290, sage #4C6B52, pink #9A4A60, purple #6A4E98, rounded corners 14–18px, gentle shadows. The new "Need to Fix" page uses a pastel look (pink #FCC8DA→#F2A1BF, mint #C2EBD0→#90D4A8, lavender #F1EBFB, butter #FFF0C4, sky #D6E5FA; Fredoka headings + Nunito body, pill buttons with a soft 5px bottom edge, no coral/orange). Matching that pastel look is welcome — ask me which one to use if unsure.

## Page 1 — Image Prompts  (`/projects/<slug>/image-prompts`, tab "Image Prompts" after "Picture List")
Purpose: one place to see **every picture's ChatGPT prompt**, copy it, tweak it.
**One picture per row**, top to bottom in video order. Each row has:
1. **Small thumbnail** (4:3, ~120px wide; click opens that picture). If no picture yet: a calm "No picture yet" placeholder.
2. **Meta line:** `IMAGE 01.2` · `IMG-014` (mono) · `Scene 1 · Rub the butter in`
3. **Title** of the picture (e.g. "Brown the beef")
4. **The prompt** — a multi-line box (long, 6+ lines, mono-ish text). Read-only until Edit.
5. **Buttons, in this order:** `COPY` · `EDIT` · `SAVE` · `CLEAR PROMPT`, plus a small status message ("Copied ✓", "Saved ✓", "Cleared — press SAVE to keep it, or CANCEL to go back.").

## Page 2 — Video Prompts  (`/projects/<slug>/video-prompts`, tab "Video Prompts" after "Video Clips")
Same layout, but **one video clip per row**:
1. **A strip of small thumbnails** (up to 6, ~56px squares) of the approved pictures that clip is built from (click opens the clip).
2. **Meta line:** `KLING-03` · `Scene 3` · status chip (`PLANNED/DRAFT/APPROVED`) · `4 pictures`
3. **Title** ("Scene 3 video — Mix the dough")
4. **The video prompt** box + the same four buttons.
Extra row type at the bottom: **"waiting" rows** (dashed, calmer) for scenes that have approved pictures but no video prompt yet: "This scene has approved pictures but no video prompt yet." + one button `Make video prompt`.

## States to design
- **Default (read-only):** prompt box looks like text you can select; EDIT is a normal button; SAVE is disabled (greyed).
- **Editing:** box becomes clearly editable (white, focused outline, taller); EDIT button turns into `CANCEL`; SAVE enabled only when the text changed.
- **Cleared:** box empty with placeholder "Type the prompt…", hint line explains nothing is lost until SAVE.
- **Empty prompt:** placeholder "No prompt yet."; COPY and CLEAR PROMPT are disabled.
- **Saving / Copied / Saved:** small message next to the buttons; SAVE button label "SAVING…".
- **Empty page:** friendly empty state ("No pictures yet." / "No video clips yet.").
- **Phone width (390px):** thumbnail goes above the content; buttons wrap into a 2×2 grid with big tap targets (≥48px).

## Rules
- Buttons large and obvious; COPY is the main action (strongest colour), SAVE second, EDIT neutral, CLEAR PROMPT quiet/destructive-looking but not scary (it is undoable until SAVE).
- Not busy: lots of whitespace, one row = one card, no extra badges beyond those listed.
- Long prompts must not blow up the page: keep a sensible default height (about 6 lines) with the box resizable.

## The exact HTML and class names to style (don't rename them)
```html
<div class="prompt-page prompt-page--images">          <!-- or prompt-page--videos -->
  <header class="prompt-page__head">
    <h1 class="prompt-page__title">Image Prompts</h1>
    <p class="prompt-page__sub">12 pictures · one prompt per row · copy, edit or clear any of them</p>
  </header>
  <ul class="prompt-page__list">
    <li class="prompt-row">                              <!-- also prompt-row--empty for "waiting" rows -->
      <a class="prompt-row__thumb"><img/></a>           <!-- images; OR: -->
      <a class="prompt-row__thumbs">                     <!-- videos: strip of -->
        <span class="prompt-row__thumb prompt-row__thumb--small"><img/></span> …
      </a>
      <!-- empty placeholder: <span class="prompt-row__thumb-empty">No picture yet</span> -->
      <div class="prompt-row__main">
        <div class="prompt-row__meta">
          <span class="prompt-row__label">IMAGE 01.2</span>   <!-- video: KLING-03 -->
          <span class="prompt-row__code">IMG-014</span>      <!-- images only -->
          <span class="prompt-row__scene">Scene 1 · Rub the butter in</span>
          <span class="prompt-row__status">DRAFT</span>      <!-- videos only -->
          <span class="prompt-row__count">4 pictures</span>   <!-- videos only -->
        </div>
        <h2 class="prompt-row__title">Brown the beef</h2>
        <p class="prompt-row__hint">…</p>                    <!-- waiting rows only -->
        <div class="prompt-row__body" data-editing="0|1">
          <textarea class="prompt-row__prompt" readonly>…</textarea>
          <div class="prompt-row__actions">
            <button class="prompt-row__btn prompt-row__btn--copy">COPY</button>
            <button class="prompt-row__btn prompt-row__btn--edit">EDIT</button>   <!-- CANCEL while editing -->
            <button class="prompt-row__btn prompt-row__btn--save">SAVE</button>
            <button class="prompt-row__btn prompt-row__btn--clear">CLEAR PROMPT</button>
            <span class="prompt-row__msg">Copied ✓</span>
          </div>
        </div>
      </div>
    </li>
  </ul>
</div>
```
Hooks you can use: `.prompt-row__body[data-editing="1"]` for the editing look, `.prompt-row__btn:disabled` for disabled.

## What I want back
A single CSS file (plain CSS, those class names only, light theme, responsive at 390px and 1280px) — plus 2 screenshots/mockups (Image Prompts, Video Prompts) so I can check it. Optional: your suggestions for anything that would make these pages calmer or faster to use.
