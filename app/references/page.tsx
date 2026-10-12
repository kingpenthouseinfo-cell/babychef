import Link from 'next/link';
import { db } from '@/lib/db';
import { PageHeader, Empty } from '@/components/ui';
import { ReferenceCard } from '@/components/refs';
import { REF_CATEGORIES, PROJECT_REF_CATEGORIES, INGREDIENT_REF_TYPES } from '@/lib/constants';

export default async function References({ searchParams }: { searchParams: { chef?: string; project?: string; category?: string; ingredient?: string; gold?: string; inactive?: string; q?: string } }) {
  const [chefs, projects] = await Promise.all([db.babyChef.findMany({ where: { deletedAt: null }, orderBy: { displayName: 'asc' } }), db.project.findMany({ where: { deletedAt: null }, orderBy: { title: 'asc' } })]);
  const refs = await db.reference.findMany({
    where: { deletedAt: null, ...(searchParams.chef ? { babyChefId: searchParams.chef } : {}), ...(searchParams.project ? { projectId: searchParams.project } : {}), ...(searchParams.category ? { category: searchParams.category } : {}), ...(searchParams.gold ? { isGold: true } : {}), ...(searchParams.inactive ? {} : { active: true }) },
    include: { asset: true, babyChef: true, project: true, ingredient: true }, orderBy: [{ isGold: 'desc' }, { createdAt: 'desc' }],
  });
  const q = (searchParams.q || searchParams.ingredient || '').toLowerCase();
  const list = refs.filter(r => !q || `${r.title} ${r.code} ${r.ingredient?.name ?? ''} ${r.ingredient?.brand ?? ''} ${r.notes ?? ''}`.toLowerCase().includes(q));
  const cats = [...new Set([...REF_CATEGORIES, ...PROJECT_REF_CATEGORIES, ...INGREDIENT_REF_TYPES])];
  return (
    <>
      <PageHeader title="References" sub="All reference images across Baby Chefs and projects. Each file is stored once and reused wherever it is attached." />
      <form className="mb-5 flex flex-wrap gap-2">
        <input name="q" defaultValue={searchParams.q} placeholder="Search title, code, ingredient…" className="input max-w-xs" aria-label="Search references" />
        <select name="chef" defaultValue={searchParams.chef || ''} className="input max-w-[180px]" aria-label="Baby Chef"><option value="">All Baby Chefs</option>{chefs.map(c => <option key={c.id} value={c.id}>{c.displayName}</option>)}</select>
        <select name="project" defaultValue={searchParams.project || ''} className="input max-w-[200px]" aria-label="Project"><option value="">All projects</option>{projects.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
        <select name="category" defaultValue={searchParams.category || ''} className="input max-w-[200px]" aria-label="Category"><option value="">All categories</option>{cats.map(c => <option key={c}>{c}</option>)}</select>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="gold" value="1" defaultChecked={!!searchParams.gold} />Gold Standard</label>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="inactive" value="1" defaultChecked={!!searchParams.inactive} />Include inactive</label>
        <button className="btn">Filter</button>
        <Link href="/corrections" className="btn">Corrections library →</Link>
      </form>
      {list.length === 0 ? <Empty title="No references match." hint="Add references on a Baby Chef page, a project's Ingredients tab, or a project's References tab." /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{list.map(r => <ReferenceCard key={r.id} r={r} cats={r.kind === 'INGREDIENT' ? INGREDIENT_REF_TYPES : r.kind === 'PROJECT' ? PROJECT_REF_CATEGORIES : REF_CATEGORIES} />)}</div>
      )}
    </>
  );
}
