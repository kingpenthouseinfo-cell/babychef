import Link from 'next/link';
import { db } from '@/lib/db';
import { PageHeader, Empty, Thumb } from '@/components/ui';

export default async function Search({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q || '').trim();
  const has = (s: string | null | undefined) => (s ?? '').toLowerCase().includes(q.toLowerCase());
  const [projects, chefs, refs, ings] = q ? await Promise.all([
    db.project.findMany({ where: { deletedAt: null } }), db.babyChef.findMany({ where: { deletedAt: null } }),
    db.reference.findMany({ where: { deletedAt: null }, include: { asset: true, project: true, ingredient: true } }), db.ingredient.findMany({ include: { project: true } }),
  ]) : [[], [], [], []] as any[][];
  const P = projects.filter((p: any) => has(p.title) || has(p.recipeName) || has(p.cuisine) || has(p.slug));
  const C = chefs.filter((c: any) => has(c.displayName) || has(c.cuisine) || has(c.seriesName));
  const R = refs.filter((r: any) => has(r.title) || has(r.code) || has(r.notes) || has(r.category) || has(r.ingredient?.name));
  const I = ings.filter((i: any) => has(i.name) || has(i.brand) || has(i.product));
  const none = q && !P.length && !C.length && !R.length && !I.length;
  return (
    <>
      <PageHeader title={q ? `Search: ${q}` : 'Search'} />
      <form className="mb-5"><input name="q" defaultValue={q} placeholder="Search projects, Baby Chefs, references, ingredients…" className="input max-w-lg" autoFocus aria-label="Search" /></form>
      {none && <Empty title="Nothing found." hint="Try a different word." />}
      {P.length > 0 && <section className="mb-5"><h2 className="mb-2">Projects</h2><ul className="card divide-y divide-line p-0">{P.map((p: any) => <li key={p.id}><Link className="block px-4 py-2 hover:bg-sunken" href={`/projects/${p.slug}`}>{p.title} <span className="text-xs text-ink-secondary">{p.recipeName}</span></Link></li>)}</ul></section>}
      {C.length > 0 && <section className="mb-5"><h2 className="mb-2">Baby Chefs</h2><ul className="card divide-y divide-line p-0">{C.map((c: any) => <li key={c.id}><Link className="block px-4 py-2 hover:bg-sunken" href={`/babychefs/${c.id}`}>{c.displayName} <span className="text-xs text-ink-secondary">{c.cuisine}</span></Link></li>)}</ul></section>}
      {I.length > 0 && <section className="mb-5"><h2 className="mb-2">Ingredients</h2><ul className="card divide-y divide-line p-0">{I.map((i: any) => <li key={i.id}><Link className="block px-4 py-2 hover:bg-sunken" href={`/projects/${i.project.slug}/ingredients`}>{i.name} {i.brand && `(${i.brand})`} <span className="text-xs text-ink-secondary">in {i.project.title}</span></Link></li>)}</ul></section>}
      {R.length > 0 && <section><h2 className="mb-2">References</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">{R.map((r: any) => <Link key={r.id} href={`/references?q=${encodeURIComponent(r.code)}`} className="block"><Thumb id={r.assetId} alt={r.title} w={240} /><div className="mt-1 truncate text-xs font-semibold">{r.code}</div><div className="truncate text-xs text-ink-secondary">{r.title}</div></Link>)}</div></section>}
    </>
  );
}
