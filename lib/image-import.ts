/** Parse a pasted production plan into one prompt per picture.
 *  A picture starts at a line like "IMG-003 - Present 417 g palm jaggery" (also "## IMG-003: …" or "**IMG-003**"). Its text runs to the next picture / "SC04 - …" scene line / ALL-CAPS heading.
 *  The "Filename:" line and the file name under it are dropped. Text before the first scene/picture under "MASTER VISUAL CONTINUITY" (Baby Chef, Kitchen, Cinematography) is returned as the shared rules. */
export type ImageSection = { seq: number; title: string; prompt: string };
export type ImagePlan = { sections: ImageSection[]; shared: string };

const IMG_LINE = /^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*IMG[\s_-]*0*(\d+)\s*(?:\*\*)?\s*[-–—:]\s*(.*?)(?:\*\*)?\s*$/i; // not a bullet: '* IMG-005: …' does not match
const SCENE_LINE = /^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*SC[\s_-]*\d+[A-Z]?\s*(?:\*\*)?\s*[-–—:]/i;
const CAPS_LINE = /^\s*(?:#{1,6}\s*)?[A-Z0-9][A-Z0-9 ,&'’()\/:-]{9,}\s*$/;
const FILE_LABEL = /^\s*\**filename\**\s*:?\s*\**\s*$/i;
const FILE_LINE = /^\s*[`'"]?[\w.\- ]+\.(?:png|jpe?g|webp)[`'"]?\s*$/i;

export function parseImagePlan(text: string): ImagePlan {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const sections: ImageSection[] = [];
  let cur: { seq: number; title: string; body: string[] } | null = null;
  let firstStructural = -1;
  const flush = () => {
    if (!cur) return;
    const body: string[] = [];
    for (let i = 0; i < cur.body.length; i++) {
      const l = cur.body[i];
      if (FILE_LABEL.test(l) || /^\s*\**filename\**\s*:\s*\S+/i.test(l)) { if (cur.body[i + 1] && FILE_LINE.test(cur.body[i + 1])) i++; continue; }
      if (FILE_LINE.test(l)) continue;
      body.push(l);
    }
    const prompt = body.join('\n').replace(/^\s+|\s+$/g, '');
    if (prompt && !sections.some(x => x.seq === cur!.seq)) sections.push({ seq: cur.seq, title: cur.title, prompt }); // first one wins
    cur = null;
  };
  lines.forEach((line, n) => {
    const m = IMG_LINE.exec(line);
    if (m) { if (firstStructural < 0) firstStructural = n; flush(); cur = { seq: parseInt(m[1], 10), title: m[2].trim(), body: [] }; return; }
    if (SCENE_LINE.test(line)) { if (firstStructural < 0) firstStructural = n; flush(); return; }
    if (cur && CAPS_LINE.test(line)) { flush(); return; }
    cur?.body.push(line);
  });
  flush();
  let shared = '';
  const head = lines.slice(0, firstStructural < 0 ? 0 : firstStructural);
  const at = head.findIndex(l => /MASTER VISUAL CONTINUITY/i.test(l));
  if (at >= 0) shared = head.slice(at).join('\n').replace(/^\s+|\s+$/g, '');
  return { sections, shared };
}
