import { db } from '@/lib/db';
import { Area, Chip, Check, PageHeader, Sel, Section, Text } from '@/components/ui';
import { ConfirmForm, DirtyForm, SubmitBtn } from '@/components/client';
import { deleteTemplate, duplicateTemplate, saveTemplate } from '@/lib/actions/prompts';
import { TEMPLATE_CATEGORIES } from '@/lib/constants';
import { VARIABLES } from '@/lib/template-engine';

function Form({ t }: { t?: any }) {
  return (
    <DirtyForm action={saveTemplate} className="grid gap-3 sm:grid-cols-2">
      {t && <input type="hidden" name="id" value={t.id} />}
      <Text name="name" label="Name *" v={t?.name} required /><Sel name="category" label="Category" v={t?.category ?? 'GENERAL'} options={TEMPLATE_CATEGORIES} />
      <Text name="purpose" label="Purpose" v={t?.purpose} /><Text name="cuisine" label="Applicable cuisine (optional)" v={t?.cuisine} />
      <Area name="description" label="Description" v={t?.description} rows={2} className="sm:col-span-2" />
      <Area name="text" label="Template text (use {{variables}})" v={t?.text} rows={14} mono className="sm:col-span-2" />
      <Check name="active" label="Active" v={t ? t.active : true} /><div className="sm:col-span-2"><SubmitBtn>SAVE TEMPLATE</SubmitBtn></div>
    </DirtyForm>
  );
}

export default async function Templates() {
  const ts = await db.promptTemplate.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  return (
    <>
      <PageHeader title="Prompt Templates" sub="Reusable text that is assembled from project data. You copy the result into ChatGPT / Claude yourself." />
      <details className="card mb-5"><summary className="cursor-pointer font-semibold">Available variables</summary><p className="mono mt-2 break-words text-xs leading-6">{VARIABLES.map(v => `{{${v}}}`).join('  ')}</p></details>
      <details className="card mb-5"><summary className="cursor-pointer font-semibold">+ New template</summary><div className="mt-3"><Form /></div></details>
      {TEMPLATE_CATEGORIES.map(c => {
        const list = ts.filter(t => t.category === c); if (!list.length) return null;
        return (
          <Section key={c} title={c}>
            {list.map(t => (
              <details key={t.id} className="border-b border-line py-2 last:border-0">
                <summary className="cursor-pointer text-sm"><b>{t.name}</b> <span className="font-mono text-xs text-ink-secondary">{t.code}</span> {t.isDefault && <Chip>DEFAULT</Chip>} {!t.active && <Chip>INACTIVE</Chip>}<span className="ml-2 text-ink-secondary">{t.purpose}</span></summary>
                <div className="mt-3"><Form t={t} />
                  <div className="mt-2 flex gap-2"><form action={duplicateTemplate}><input type="hidden" name="id" value={t.id} /><SubmitBtn className="" pendingText="…">DUPLICATE TEMPLATE</SubmitBtn></form>
                    <ConfirmForm action={deleteTemplate} message={t.isDefault ? 'Deactivate this default template?' : 'Delete this template?'}><input type="hidden" name="id" value={t.id} /><button className="btn btn-danger">{t.isDefault ? 'Deactivate' : 'Delete'}…</button></ConfirmForm></div></div>
              </details>))}
          </Section>);
      })}
    </>
  );
}
