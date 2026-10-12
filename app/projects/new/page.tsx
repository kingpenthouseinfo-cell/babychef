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
      <PageHeader title="New Recipe Video" sub="Only the title is required — fill in the rest as you go." />
      <DirtyForm action={createProject} className="space-y-4">
        <div className="card grid gap-3 sm:grid-cols-2">
          <Text name="title" label="Project title *" required placeholder="Jamaican Beef Patties" className="sm:col-span-2" />
          <Text name="recipeName" label="Recipe name" />
          <Text name="cuisine" label="Cuisine" />
          <Sel name="babyChefId" label="Baby Chef" v={searchParams.chef || ''} options={[['', '— select —'], ...chefs.map(c => [c.id, c.displayName] as [string, string])]} hint={chefs.length ? undefined : 'No Baby Chefs yet — create one first.'} />
          <Sel name="status" label="Status" v={s.defaultProjectStatus} options={PROJECT_STATUSES} />
          <Text name="longDuration" label="Long-form target duration" v={s.defaultLongDuration} />
          <Text name="shortDuration" label="Short-form target duration" v={s.defaultShortDuration} />
          <Text name="aspectRatio" label="Primary aspect ratio" v={s.defaultAspect} />
          <div className="flex items-end"><Check name="verticalCrop" label="Vertical crop required" v={s.defaultVerticalCrop === 'true'} /></div>
          <Area name="description" label="Project description" className="sm:col-span-2" />
          <Text name="recipeSource" label="Recipe source" className="sm:col-span-2" />
          <Area name="recipeOriginal" label="Full recipe text (paste)" rows={8} className="sm:col-span-2" />
        </div>
        <SubmitBtn pendingText="Creating…">START RECIPE VIDEO</SubmitBtn>
      </DirtyForm>
    </>
  );
}
