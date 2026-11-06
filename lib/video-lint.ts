import { dialogueLines } from './step-dialogue';

/** Checks of a video prompt against the writing rules. Plain text in, short plain-words warnings out. Nothing is changed. */
export type LintInput = { prompt: string; approvedDialogue: string[]; hasReferences: boolean; speakerLabel?: string };

const norm = (s: string) => s.toLowerCase().replace(/[“”"‘’']/g, '').replace(/[^a-z0-9À-￿ ]+/g, ' ').replace(/\s+/g, ' ').trim();

export function lintVideoPrompt(i: LintInput): string[] {
  const out: string[] = [];
  const text = i.prompt.trim();
  if (!text) return out;
  const quotes = [...text.matchAll(/[“"]([^”"\n]{3,})[”"]/g)];
  const lines = i.approvedDialogue.flatMap(d => dialogueLines(d)).map(norm).filter(Boolean);
  const label = norm(i.speakerLabel ?? '');
  let noName = 0, changed = 0;
  for (const q of quotes) {
    const before = text.slice(Math.max(0, (q.index ?? 0) - 160), q.index ?? 0);
    const sentence = before.split(/[.!?\n]/).pop() ?? before;
    if (!/says|saying|said|exclaims|whispers|asks/i.test(before.slice(-90))) continue; // a quote that is not speech
    const named = label ? norm(sentence).includes(label.slice(0, Math.min(label.length, 28))) : /baby chef/i.test(sentence) && /toddler/i.test(sentence);
    if (!named) noName++;
    const said = norm(q[1]);
    if (lines.length && !lines.some(l => l === said || l.includes(said) || said.includes(l))) changed++;
  }
  if (noName) out.push(`${noName} spoken line${noName > 1 ? 's don’t' : ' doesn’t'} start with the full character name (like “Cute toddler … baby chef with a slight accent says …”).`);
  if (changed) out.push(`${changed} spoken line${changed > 1 ? 's don’t' : ' doesn’t'} match the approved script exactly. Check the words.`);
  if (/\bbaby chef says\b/i.test(text) && !/toddler/i.test(text)) out.push('It says “Baby Chef says”. Use the full character name before each line.');
  if (/continue(s|d)?\s+from\s+(the\s+)?(previous|last|prior)/i.test(text)) out.push('It says “continue from the previous scene”. Every clip must make sense on its own.');
  const emos = [...text.matchAll(/\bsays\s+([a-z ]{3,40}?):/gi)].map(m => m[1].toLowerCase().trim());
  const counts = new Map<string, number>(); for (const e of emos) counts.set(e, (counts.get(e) ?? 0) + 1);
  for (const [e, n] of counts) if (n >= 3) out.push(`“says ${e}” is used ${n} times. Vary the feeling or use plain “says” for neutral lines.`);
  const words = text.split(/\s+/).length;
  if (words > 170) out.push(`${words} words is long for a 3–10 second clip. Shorten it or split it into two clips.`);
  const spoken = quotes.reduce((n, q) => n + q[1].split(/\s+/).length, 0);
  if (spoken > 30) out.push(`${spoken} spoken words won’t fit naturally in 10 seconds. Split the dialogue across two clips.`);
  if (i.hasReferences && !/@image|start image|end image|\[start|first image|starting image/i.test(text)) out.push('It doesn’t mention the start and end pictures.');
  if (/background music/i.test(text) && !/(no|without|avoid|don.?t|never)[^.]{0,30}background music/i.test(text)) out.push('It asks for background music. Your rules say none.');
  return out;
}
