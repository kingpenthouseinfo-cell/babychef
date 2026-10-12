import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getProjectBySlug } from '@/lib/queries';
import { DirtyForm, SubmitBtn, CopyButton } from '@/components/client';
import { Area, Section, Text } from '@/components/ui';
import { saveRecipe } from '@/lib/actions/project';
import { fmtDate } from '@/lib/util';

export default async function Recipe({ params }: { params: { slug: string } }) {
  const p = await getProjectBySlug(params.slug);
  if (!p) notFound();
  const versions = await db.recipeVersion.findMany({ where: { projectId: p.id }, orderBy: { version: 'desc' } });
  return (
    <div className="space-y-5">
      <Section title={`Recipe (version ${p.recipeVersion})`} right={<span className="text-xs text-ink-secondary">Last modified {fmtDate(p.updatedAt)}</span>}>
        <DirtyForm action={saveRecipe} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={p.id} />
          <Text name="recipeName" label="Recipe title" v={p.recipeName} />
          <Text name="cuisine" label="Cuisine" v={p.cuisine} />
          <Text name="recipeSource" label="Source" v={p.recipeSource} />
          <Text name="recipeYield" label="Yield / servings" v={p.recipeYield} />
          <Text name="prepTime" label="Preparation time" v={p.prepTime} />
          <Text name="cookTime" label="Cooking time" v={p.cookTime} />
          <Area name="recipeOriginal" label="Original recipe text" v={p.recipeOriginal} rows={14} className="sm:col-span-2" mono />
          <Area name="recipeAdapted" label="Adapted recipe text" v={p.recipeAdapted} rows={14} className="sm:col-span-2" mono />
          <Area name="recipeNotes" label="Notes" v={p.recipeNotes} className="sm:col-span-2" />
          <div className="flex flex-wrap gap-2 sm:col-span-2"><SubmitBtn>SAVE</SubmitBtn><CopyButton text={p.recipeAdapted || p.recipeOriginal || ''} label="COPY RECIPE" /></div>
        </DirtyForm>
      </Section>
      {versions.length > 0 && (
        <Section title="Previous recipe versions">
          {versions.map(v => <details key={v.id} className="border-b border-line py-2"><summary className="cursor-pointer text-sm font-medium">Version {v.version} · {fmtDate(v.createdAt)}</summary><pre className="mono mt-2 whitespace-pre-wrap">{v.adapted || v.original}</pre></details>)}
        </Section>
      )}
    </div>
  );
}
