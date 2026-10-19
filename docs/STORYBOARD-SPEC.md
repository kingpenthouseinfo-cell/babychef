# Claude Design brief — "Storyboard" page (Baby Chef Studio)

Paste everything below into Claude Design. The page is already built and working; I need the **look** (CSS). Send back one CSS file that replaces `app/storyboard.css` — no other file needs to change.

## What the app is (30 seconds)
Baby Chef Studio is a private Mac app (Next.js + Tailwind) for making AI Baby Chef cooking videos. A recipe video is a list of **scenes**, and each scene has several **pictures** (AI-generated stills that later become video clips). The creator is not technical: she wants **big, obvious, calm, uncluttered** screens.

Existing look: white background, soft lavender-grey (#F4F3F7) areas, ink #1E1D22, blue #3E6290, sage #4C6B52, pink #9A4A60, purple #6A4E98, rounded corners 14–18px, gentle shadows. The "Need to Fix" page uses a pastel look (pink #FCC8DA→#F2A1BF, mint #C2EBD0→#90D4A8, lavender #F1EBFB, butter #FFF0C4, sky #D6E5FA; Fredoka headings + Nunito body, pill buttons with a soft bottom edge, no coral/orange). Matching that pastel look is welcome — ask me which one to use if unsure.

## The Storyboard page  (`/projects/<slug>/storyboard`, tab "Storyboard" right after "Scenes & Pictures")
**Purpose:** see the **whole video at a glance** — only thumbnails, in order — and rearrange it. **The order you leave it in on this page is the saved order for the whole app** (scene order and picture order).

### What it shows
- Page title "Storyboard" + one-line help ("All the pictures in video order. Drag to rearrange, or press + to add one in between. A picture takes the scene of the picture it lands next to. What you see here is the saved order.")
- A small status bar: `30 pictures` and a message area ("Saving…", "Saved ✓", "Picture added ✓").
- Then **ONE flat wrapping grid of every picture, in order — NOT grouped by scene** (no scene headers or bars). Each item:
  - **Tile:** small 4:3 thumbnail (~130px wide), under it the label `04.2` (scene.picture) with a small **status dot** (grey = not made, gold = made/waiting review, green = approved, red = needs fix), and the picture title (max 2 lines). Clicking the thumbnail opens that picture. If there is no image yet the tile shows a calm "No picture yet" placeholder.
  - **Between tiles (and at the very start): a small round `+` button** to add a new picture in that exact spot.
  - **A scene that exists but has no pictures yet** appears **inline in its place** as a dashed **placeholder tile**: `Scene 5` · `No picture yet` · the scene title · `+ Add one`. It is also a drop target.
- Pictures are **draggable**: drag a tile before/after another tile. While dragging, the spot where it will land shows a thin blue marker on the left/right edge of the tile it is over. (Behind the scenes a picture joins the scene of the picture it lands next to; the label under the tile shows the scene number so this is visible.)

### States to design
- **Default**, **hover** over a tile (lift / shadow, grab cursor), **dragging** (the tile being dragged is semi-transparent), **drop marker** (`.is-before` / `.is-after` classes), **saving/saved message**.
- **Empty-scene placeholder tile** and **tile without image placeholder**.
- **Many pictures:** the grid wraps; 40+ pictures in total should still feel light and scannable.
- **Phone width (390px):** tiles ~3 per row; `+` buttons still tappable (≥ 32px hit area). (Drag works with a mouse; on phones people open the picture instead.)

### Rules
- **Calm, not busy.** Thumbnails are the hero; text is small and quiet. No heavy borders around every tile.
- The `+` buttons must be discoverable but not noisy (quiet until hover/focus; always visible on touch).
- No scene grouping. If you want to hint at scene changes, do it subtly through the `04.2` label only.
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
      <span class="storyboard__count">30 pictures</span>
      <span class="storyboard__msg">Saved ✓</span>
    </div>
    <div class="storyboard__tiles">                         <!-- ONE flat wrapping row of everything -->
      <button class="storyboard__add storyboard__add--start">+</button>   <!-- very start -->

      <div class="storyboard__slot">                        <!-- one per picture -->
        <div class="storyboard__tile [is-before|is-after]" draggable>
          <a class="storyboard__thumb"><img/></a>           <!-- or <span class="storyboard__thumb-empty">No picture yet</span> -->
          <div class="storyboard__code">04.2 <span class="storyboard__dot storyboard__dot--approved"></span></div>
          <div class="storyboard__title">Add the jaggery to the coconut milk</div>
        </div>
        <button class="storyboard__add">+</button>          <!-- after every tile -->
      </div>

      <!-- a scene with no pictures, in its place in the run -->
      <div class="storyboard__empty">
        <span class="storyboard__empty-scene">Scene 5</span>
        <span class="storyboard__empty-text">No picture yet</span>
        <span class="storyboard__empty-title">Add the cardamom</span>
        <button class="storyboard__add">+ Add one</button>
      </div>
    </div>
  </div>
</div>
```
Status dot modifiers in use: `--approved`, `--redo`, `--needs-revision`, `--review`, `--generating`; anything else is the default grey. Drop markers: `.is-before` / `.is-after` on `.storyboard__tile`.

## What I want back
A single CSS file (plain CSS, those class names only, light theme, responsive at 390px and 1280px) — plus 2 mockups (a project with many pictures, and one with an empty-scene placeholder in the middle) so I can check it. Optional: suggestions to make the page calmer or quicker to scan.
