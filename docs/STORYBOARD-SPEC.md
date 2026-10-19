# Claude Design brief — "Storyboard" page (Baby Chef Studio)

Paste everything below into Claude Design. The page is already built and working; I need the **look** (CSS). Send back one CSS file that replaces `app/storyboard.css` — no other file needs to change.

## What the app is (30 seconds)
Baby Chef Studio is a private Mac app (Next.js + Tailwind) for making AI Baby Chef cooking videos. A recipe video is a list of **scenes**, and each scene has several **pictures** (AI-generated stills that later become video clips). The creator is not technical: she wants **big, obvious, calm, uncluttered** screens.

Existing look: white background, soft lavender-grey (#F4F3F7) areas, ink #1E1D22, blue #3E6290, sage #4C6B52, pink #9A4A60, purple #6A4E98, rounded corners 14–18px, gentle shadows. The "Need to Fix" page uses a pastel look (pink #FCC8DA→#F2A1BF, mint #C2EBD0→#90D4A8, lavender #F1EBFB, butter #FFF0C4, sky #D6E5FA; Fredoka headings + Nunito body, pill buttons with a soft bottom edge, no coral/orange). Matching that pastel look is welcome — ask me which one to use if unsure.

## The Storyboard page  (`/projects/<slug>/storyboard`, tab "Storyboard" right after "Scenes & Pictures")
**Purpose:** see the **whole video at a glance** — only thumbnails, in order — and rearrange it. **The order you leave it in on this page is the saved order for the whole app** (scene order and picture order).

### What it shows
- Page title "Storyboard" + one-line help ("All pictures in video order. Drag to rearrange — even into another scene — or press + to add one in between. What you see here is the saved order.")
- A small status bar: `30 pictures · 12 scenes` and a message area ("Saving…", "Saved ✓", "Picture added ✓").
- Then **one section per scene, in order**, each containing:
  1. **Scene bar (header):** a drag grip `⠿` (drag the whole scene up/down), `Scene 4`, the scene title (e.g. "Add the palm jaggery"), `3 pictures`, and a `+ Add picture` button (adds at the end of that scene).
  2. **A wrapping row of picture tiles** (the thumbnails), in order.
     - **Tile:** small 4:3 thumbnail (~130px wide), under it the label `04.2` (scene.picture) with a small **status dot** (grey = not made, gold = made/waiting review, green = approved, red = needs fix), and the picture title (max 2 lines). Clicking the thumbnail opens that picture. If there is no image yet the tile shows a calm "No picture yet" placeholder.
     - **Between tiles (and at the very start of the row): a small round `+` button** to add a new picture in that exact spot.
     - **Empty scene:** a dashed **placeholder tile** across the row — "No picture yet · Drop a picture here · + Add one" — so every scene exists on the page even with no pictures.
- Pictures are **draggable**: drag a tile before/after another tile, or onto another scene's row (that moves the picture into that scene), or onto an empty scene's placeholder. While dragging, the spot where it will land shows a thin blue marker (left/right edge of a tile; top/bottom edge of a scene bar when moving a scene).

### States to design
- **Default**, **hover** over a tile (lift / shadow, grab cursor), **dragging** (the tile being dragged is semi-transparent), **drop marker** (`.is-before` / `.is-after` classes), **saving/saved message**.
- **Empty scene placeholder** and **tile without image placeholder**.
- **Many pictures:** rows wrap; up to ~12 tiles per scene should still look tidy. 40+ pictures in total should still feel light and scannable.
- **Phone width (390px):** tiles ~3 per row; `+` buttons still tappable (≥ 32px hit area). (Drag works with a mouse; on phones people open the picture instead.)

### Rules
- **Calm, not busy.** Thumbnails are the hero; text is small and quiet. No heavy borders around every tile.
- The `+` buttons must be discoverable but not noisy (quiet until hover/focus; always visible on touch).
- Scene bars should make scene boundaries obvious at a glance without feeling heavy (a soft band or color tab per scene is fine).
- Status dots only — no big badges.

## The exact HTML and class names to style (don't rename them)
```html
<div class="storyboard-page">
  <header class="storyboard-page__head">
    <h1 class="storyboard-page__title">Storyboard</h1>
    <p class="storyboard-page__sub">…</p>
  </header>
  <div class="storyboard">
    <div class="storyboard__bar">
      <span class="storyboard__count">30 pictures · 12 scenes</span>
      <span class="storyboard__msg">Saved ✓</span>
    </div>

    <section class="storyboard__scene">                       <!-- one per scene -->
      <header class="storyboard__head [is-before|is-after]">  <!-- drop marker when a scene is dragged over -->
        <span class="storyboard__grip" draggable>⠿</span>
        <span class="storyboard__scene-label">Scene 4</span>
        <span class="storyboard__scene-title">Add the palm jaggery</span>
        <span class="storyboard__scene-count">3 pictures</span>
        <button class="storyboard__add-end">+ Add picture</button>
      </header>
      <div class="storyboard__tiles">
        <!-- empty scene: -->
        <div class="storyboard__empty">
          <span class="storyboard__empty-text">No picture yet</span>
          <span class="storyboard__empty-hint">Drop a picture here</span>
          <button class="storyboard__add">+ Add one</button>
        </div>
        <!-- each picture: -->
        <div class="storyboard__slot">
          <button class="storyboard__add storyboard__add--start">+</button>   <!-- first tile only -->
          <div class="storyboard__tile [is-before|is-after]" draggable>
            <a class="storyboard__thumb"><img/></a>          <!-- or <span class="storyboard__thumb-empty">No picture yet</span> -->
            <div class="storyboard__code">04.2 <span class="storyboard__dot storyboard__dot--approved"></span></div>
            <div class="storyboard__title">Add the jaggery to the coconut milk</div>
          </div>
          <button class="storyboard__add">+</button>        <!-- after every tile -->
        </div>
      </div>
    </section>
  </div>
</div>
```
Status dot modifiers in use: `--approved`, `--redo`, `--needs-revision`, `--review`, `--generating`; anything else is the default grey. Drop markers: `.is-before` / `.is-after` on `.storyboard__tile` and `.storyboard__head`.

## What I want back
A single CSS file (plain CSS, those class names only, light theme, responsive at 390px and 1280px) — plus 2 mockups (a project with many pictures, and one with an empty scene) so I can check it. Optional: suggestions to make the page calmer or quicker to scan.
