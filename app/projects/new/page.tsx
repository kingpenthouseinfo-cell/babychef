import Link from 'next/link';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { PageHeader, Text, Area, Sel, Check } from '@/components/ui';
import { DirtyForm, SubmitBtn } from '@/components/client';
import { createProject } from '@/lib/actions/project';
import { PROJECT_STATUSES } from '@/lib/constants';

export default async function NewProject({ searchParams }: { searchParams: { chef?: string } }) {
  const [chefs, s] = await Promise.all([db.babyChef.findMany({ where: { deletedAt: null, active: true }, orderBy: { displayName: 'asc' } }), getSettings()]);
  return (
    <>
      <PageHeader title="New Recipe Video" sub="Just a name, the recipe and a Baby Chef — then I’ll tell you what to do next."><Link href="/fill" className="btn btn-copy-secondary">FILL FROM TEXT</Link></PageHeader>
      <DirtyForm action={createProject} className="space-y-4">
        <div className="card space-y-3">
          <Text name="title" label="Recipe Video Name *" required placeholder="Jamaican Beef Patties" />
          <Area name="recipeOriginal" label="Recipe (paste it here)" rows={8} hint="Ingredients and steps are fine — you can tidy it up later." />
          <Sel name="babyChefId" label="Baby Chef" v={searchParams.chef || ''} options={[['', '— choose —'], ...chefs.map(c => [c.id, c.displayName] as [string, string])]} hint={chefs.length ? undefined : 'No Baby Chefs yet — create one first.'} />
          <Text name="kitchen" label="Kitchen (optional)" placeholder="e.g. Grandma's bright yellow kitchen" />
        </div>
        <details className="card"><summary className="cursor-pointer text-[14px] font-semibold">MORE OPTIONS</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Text name="recipeName" label="Recipe name (if different)" /><Text name="cuisine" label="Cuisine" />
            <Sel name="status" label="Status" v={s.defaultProjectStatus} options={PROJECT_STATUSES} />
            <Text name="longDuration" label="Long video length" v={s.defaultLongDuration} /><Text name="shortDuration" label="Short/Reel length" v={s.defaultShortDuration} />
            <Text name="aspectRatio" label="Picture shape" v={s.defaultAspect} />
            <div className="flex items-end"><Check name="verticalCrop" label="Also make a vertical version" v={s.defaultVerticalCrop === 'true'} /></div>
            <Area name="description" label="Description" className="sm:col-span-2" /><Text name="recipeSource" label="Where the recipe came from" className="sm:col-span-2" />
          </div></details>
        <SubmitBtn pendingText="Creating…">START RECIPE VIDEO</SubmitBtn>
      </DirtyForm>
    </>
  );
}
