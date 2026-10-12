import Link from 'next/link';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { Text, Area, Sel, Check } from '@/components/ui';
import { DirtyForm, SubmitBtn } from '@/components/client';
import { FillModalButton } from '@/components/fill-modal';
import { createProject } from '@/lib/actions/project';
import { PROJECT_STATUSES } from '@/lib/constants';

const GRADS = ['#E9C9A2,#A8774C', '#EBD2B4,#9E6E45', '#F1DECB,#B88E6B'];
const AUTO: [string, string][] = [['Baby Chef profile', 'Looks, outfit, voice and kitchen'], ['My Video Style', 'Lighting, camera and pacing rules'], ['Scene plan', 'Drafted from the recipe method'], ['Folder on this Mac', 'Documents / Baby Chef Studio / <name>'], ['File names', 'Every picture gets one before you make it'], ['Folder watching', 'Saved pictures attach themselves']];

export default async function NewProject({ searchParams }: { searchParams: { chef?: string } }) {
  const [chefs, s] = await Promise.all([db.babyChef.findMany({ where: { deletedAt: null, active: true }, orderBy: { displayName: 'asc' }, include: { references: { where: { deletedAt: null }, take: 1, orderBy: { isGold: 'desc' } } } }), getSettings()]);
  return (
    <div className="mx-auto max-w-[1040px]">
      <Link href="/projects" className="text-[13px] text-ink-secondary hover:text-ink">← Recipe Videos</Link>
      <h1 className="mb-6 mt-1 text-[34px] md:text-[40px]">New Recipe Video</h1>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <DirtyForm action={createProject} className="card space-y-5 !p-7">
          <Text name="title" label="Recipe Video Name *" required placeholder="Jamaican Beef Patties" />
          <Area name="recipeOriginal" label="Recipe" rows={8} placeholder="Paste the whole recipe — ingredients and method are pulled out for you." />
          <fieldset><legend className="label">Baby Chef</legend>
            {chefs.length === 0 ? <p className="text-[13px] text-ink-secondary">No Baby Chefs yet — <Link href="/babychefs/new" className="underline">create one first</Link>.</p> : (
              <div className="grid gap-2.5 sm:grid-cols-3">{chefs.map((c, i) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line-strong bg-white px-3 py-3 text-[14.5px] has-[:checked]:border-ink has-[:checked]:shadow-[0_0_0_1px_#1E1D22]">
                  <input type="radio" name="babyChefId" value={c.id} defaultChecked={searchParams.chef === c.id} className="sr-only" />
                  {c.references[0] ? <img src={`/api/files/${c.references[0].assetId}?w=80`} alt="" className="h-[34px] w-[34px] rounded-full object-cover" /> : <span className="h-[34px] w-[34px] rounded-full" style={{ background: `linear-gradient(135deg,${GRADS[i % 3].replace(',', ' 0%,')} 100%)` }} />}
                  <span className="font-medium leading-tight">{c.displayName}</span></label>))}</div>)}
          </fieldset>
          <Text name="kitchen" label="Kitchen (optional)" placeholder="e.g. Grandma's bright yellow kitchen" />
          <details className="border-t border-line pt-4"><summary className="cursor-pointer text-[14px] text-ink-secondary">+ More options</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Text name="recipeName" label="Recipe name (if different)" /><Text name="cuisine" label="Cuisine" />
              <Sel name="status" label="Status" v={s.defaultProjectStatus} options={PROJECT_STATUSES} />
              <Text name="longDuration" label="Long video target" v={s.defaultLongDuration} /><Text name="shortDuration" label="Short video target" v={s.defaultShortDuration} />
              <Text name="aspectRatio" label="Picture shape" v={s.defaultAspect} />
              <div className="flex items-end"><Check name="verticalCrop" label="Also make a vertical version" v={s.defaultVerticalCrop === 'true'} /></div>
              <Area name="mainHook" label="Hook" className="sm:col-span-2" hint="What makes people keep watching in the first seconds." /><Area name="finishedFood" label="Finished food" className="sm:col-span-2" /><Text name="ctaCustom" label="Call to action" className="sm:col-span-2" /><Area name="description" label="Description" className="sm:col-span-2" /><Text name="recipeSource" label="Where the recipe came from" className="sm:col-span-2" />
            </div></details>
          <div className="flex flex-wrap gap-3"><SubmitBtn className="btn-primary min-h-[48px] px-6" pendingText="Creating…">Create video</SubmitBtn><FillModalButton slug={null} current={{}} ingredientNames={[]} sceneTitles={[]} chefs={chefs.map(c => ({ id: c.id, name: c.displayName }))} history={[]} /></div>
        </DirtyForm>
        <aside className="h-fit rounded-[18px] border border-line bg-[#F8F7FB] p-6"><div className="eyebrow mb-4">SET UP AUTOMATICALLY</div>
          <ul className="space-y-4">{AUTO.map(([t, d]) => <li key={t} className="flex gap-3 text-[14px]"><span className="text-[#46704F]">✓</span><span><b className="block font-semibold">{t}</b><span className="text-ink-secondary">{d}</span></span></li>)}</ul></aside>
      </div>
    </div>
  );
}
