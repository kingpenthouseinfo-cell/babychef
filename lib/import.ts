export type ParsedScene = { title: string; fields: Record<string, string> };

const LABELS: [string, string][] = [
  ['SCENE TITLE', 'title'], ['PURPOSE', 'purpose'], ['RECIPE STEP', 'recipeStep'], ['DIALOGUE', 'dialogue'], ['BABY ACTION', 'mainAction'], ['ADULT ASSISTANCE', 'adult'],
  ['FOOD STATE BEFORE', 'foodBefore'], ['FOOD STATE DURING', 'foodDuring'], ['FOOD STATE AFTER', 'foodAfter'], ['MAIN SHOT', 'mainShot'], ['INSERT SHOTS', 'inserts'],
  ['ASMR', 'asmr'], ['CAMERA', 'cameraAngle'], ['SHORT KEEP', 'shortKeep'], ['ESTIMATED DURATION', 'duration'], ['PLANNED IMAGE ANCHORS', 'anchors'], ['KLING GROUPING NOTE', 'klingNote'],
];

/**
 * Conservative parser for the structured Markdown requested by the Scene Breakdown /
 * Production Plan prompts. It only READS text; importing is previewed first and
 * never deletes or overwrites existing scenes.
 */
export function parseScenes(text: string): ParsedScene[] {
  const out: ParsedScene[] = [];
  const headRe = /^\s*#{1,6}\s*\**\s*SCENE\s*(\d+)?\s*[—–:\-.]*\s*(.*?)\**\s*$/i;
  let cur: ParsedScene | null = null;
  let key: string | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\*\*/g, '');
    const h = headRe.exec(raw);
    if (h && !/^\s*#{1,6}\s*SCENES\b/i.test(raw)) {
      cur = { title: (h[2] || '').trim(), fields: {} }; out.push(cur); key = null; continue;
    }
    if (!cur) continue;
    if (/^\s*#{1,6}\s*\S/.test(raw) && !h) { cur = null; key = null; continue; } // next top-level section
    const m = /^\s*[-*]?\s*([A-Z][A-Z \/]+?)\s*:\s*(.*)$/.exec(line);
    const hit = m && LABELS.find(([l]) => l === m[1].trim().toUpperCase());
    if (hit && m) { key = hit[1]; cur.fields[key] = m[2].trim(); if (key === 'title' && m[2].trim()) cur.title = m[2].trim(); continue; }
    if (key && line.trim()) cur.fields[key] = `${cur.fields[key] ? cur.fields[key] + '\n' : ''}${line.trim()}`;
  }
  return out.filter(s => s.title || Object.keys(s.fields).length);
}

export function toSceneData(s: ParsedScene) {
  const f = s.fields;
  const adult = (f.adult || '').toUpperCase();
  const yes = (v?: string) => /^\s*(yes|y|true)\b/i.test(v || '');
  return {
    title: (s.title || f.title || 'Untitled scene').slice(0, 120),
    purpose: f.purpose || null, recipeStep: f.recipeStep || null, dialogue: f.dialogue || null, mainAction: f.mainAction || null,
    adultAssist: adult.startsWith('YES') ? 'YES' : adult.startsWith('OPTIONAL') ? 'OPTIONAL' : 'NO', adultNotes: f.adult || null,
    foodBefore: f.foodBefore || null, foodDuring: f.foodDuring || null, foodAfter: f.foodAfter || null,
    mainShot: f.mainShot || null, insertShots: f.inserts || null, duration: f.duration || null, anchors: f.anchors || null, klingNote: f.klingNote || null,
    asmr: f.asmr || null, cameraAngle: f.cameraAngle || null, shortKeep: yes(f.shortKeep),
    notes: [f.mainShot && `Main shot: ${f.mainShot}`, f.inserts && `Insert shots: ${f.inserts}`, f.duration && `Estimated duration: ${f.duration}`, f.anchors && `Planned image anchors: ${f.anchors}`, f.klingNote && `Kling grouping note: ${f.klingNote}`].filter(Boolean).join('\n') || null,
  };
}
