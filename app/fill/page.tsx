import { db } from '@/lib/db';
import { PageHeader } from '@/components/ui';
import { FillFromText } from '@/components/fill-client';

export default async function FillNew() {
  const chefs = await db.babyChef.findMany({ where: { deletedAt: null }, orderBy: { displayName: 'asc' } });
  return (<><PageHeader title="Start a recipe video from text" sub="Paste the recipe or Baby Chef Studio text here and I’ll fill in the form for you." />
    <FillFromText slug={null} current={{}} ingredientNames={[]} sceneTitles={[]} chefs={chefs.map(c => ({ id: c.id, name: c.displayName }))} history={[]} /></>);
}
