import Link from 'next/link';
import { db } from '@/lib/db';
import { Chip, Empty, PageHeader, Thumb } from '@/components/ui';

export default async function BabyChefs() {
  const chefs = await db.babyChef.findMany({
    where: { deletedAt: null }, orderBy: { displayName: 'asc' },
    include: { references: { where: { deletedAt: null }, orderBy: [{ isGold: 'desc' }, { createdAt: 'asc' }], take: 1, include: { asset: true } }, _count: { select: { projects: true, references: true } } },
  });
  return (
    <>
      <PageHeader title="Baby Chefs" sub="Reusable character profiles and master references"><Link href="/babychefs/new" className="btn btn-primary">+ ADD BABY CHEF</Link></PageHeader>
      {chefs.length === 0 ? <Empty title="No Baby Chefs yet." hint="Create your first Baby Chef to begin."><Link href="/babychefs/new" className="btn btn-primary">+ ADD BABY CHEF</Link></Empty> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chefs.map(c => (
            <Link key={c.id} href={`/babychefs/${c.id}`} className="card block hover:border-ink">
              <Thumb id={c.references[0]?.assetId} alt={c.displayName} />
              <div className="mt-3 flex items-center justify-between gap-2"><div className="font-semibold">{c.displayName}</div>{!c.active && <Chip>INACTIVE</Chip>}</div>
              <div className="text-sm text-ink-secondary">{[c.seriesName, c.cuisine].filter(Boolean).join(' · ') || '—'}</div>
              <div className="mt-1 text-xs text-ink-secondary">{c._count.references} references · {c._count.projects} projects</div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
