import { db } from './db';
import { buildVars } from './template-engine';
import { parseJson } from './util';
import { PUB_CONTEXT_FIELDS } from './constants';

export async function contextBlock(projectId: string): Promise<string> {
  const [p, doc, vars] = await Promise.all([
    db.project.findUniqueOrThrow({ where: { id: projectId }, include: { babyChef: true } }),
    db.projectDoc.findUnique({ where: { projectId_key: { projectId, key: 'pubctx' } } }),
    buildVars(projectId),
  ]);
  const d = parseJson<any>(doc?.data, { include: PUB_CONTEXT_FIELDS });
  const inc: string[] = d.include ?? PUB_CONTEXT_FIELDS;
  const val: Record<string, string> = {
    'Project title': p.title, Recipe: vars.recipe_name, Cuisine: vars.cuisine, 'Baby Chef': vars.baby_name, Personality: vars.baby_personality, 'Dialogue style': vars.dialogue_style,
    Hook: vars.hook, 'Finished food description': vars.finished_food_description, 'Funny moments': d['Funny moments'] ?? '', 'SHORT KEEP moments': vars.short_keep_moments,
    'Recipe highlights': d['Recipe highlights'] ?? '', 'Cooking techniques': d['Cooking techniques'] ?? '', 'Video duration': `Long ${vars.long_form_duration}`, 'Short duration': vars.short_form_duration, 'CTA preference': vars.cta, Notes: d.Notes ?? '',
  };
  return inc.filter(k => (val[k] ?? '').trim()).map(k => `${k}: ${val[k]}`).join('\n');
}

