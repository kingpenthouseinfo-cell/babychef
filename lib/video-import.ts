/** Parse pasted text (e.g. a ChatGPT/Claude answer) into one video prompt per picture/clip.
 *  Recognised: a heading that names picture codes ("## IMG-003: Palm jaggery presentation", "### IMG-001 + IMG-002"), then optionally a line "KLING PROMPT" / "VIDEO PROMPT" / "PROMPT", then the prompt text up to the next heading. */
export type VideoSection = { seqs: number[]; title: string; prompt: string };

const HEADING = /^(#{1,6})\s+(.*)$/;
const MARKER = /^[\s*_#>]*(?:kling\s+|video\s+)?prompt[\s*_:]*$/i;

export function parseVideoPrompts(text: string): VideoSection[] {
  const lines = text.replace(/\r\n?/g, '\n').replace(/&#x20;/g, ' ').split('\n');
  const out: VideoSection[] = [];
  let cur: { seqs: number[]; title: string; body: string[] } | null = null;
  const flush = () => {
    if (!cur) return;
    let body = cur.body;
    const m = body.findIndex(l => MARKER.test(l));
    if (m >= 0) body = body.slice(m + 1);
    const prompt = body.join('\n').replace(/^\s+|\s+$/g, '');
    if (prompt) out.push({ seqs: cur.seqs, title: cur.title, prompt });
    cur = null;
  };
  for (const line of lines) {
    const h = HEADING.exec(line);
    if (h) {
      const level = h[1].length;
      const seqs = [...h[2].matchAll(/\bIMG[\s_-]*0*(\d+)\b/gi)].map(x => parseInt(x[1], 10));
      if (seqs.length) { flush(); cur = { seqs, title: h[2].replace(/\*+/g, '').trim(), body: [] }; continue; }
      if (level <= 2) { flush(); continue; } // a new top-level section (rules, notes…) ends the prompt
    }
    cur?.body.push(line);
  }
  flush();
  return out;
}
