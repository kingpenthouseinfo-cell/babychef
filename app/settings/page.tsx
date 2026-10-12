import Link from 'next/link';
import path from 'path';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { getStorageRoot, DEFAULT_ROOT_LABEL } from '@/lib/storage';
import { currentBibleVersion } from '@/lib/bible';
import { PageHeader, Section, Text, Area, Sel, Check } from '@/components/ui';
import { DirtyForm, SubmitBtn } from '@/components/client';
import { StorageRootForm } from '@/components/settings-client';
import { saveSettings } from '@/lib/actions/settings';
import { PROJECT_STATUSES, TOOL_NAMES } from '@/lib/constants';

export default async function Settings() {
  const s = await getSettings();
  const [root, tplCount, assets, projects, bibleV, dbUrl] = await Promise.all([
    getStorageRoot(), db.promptTemplate.count({ where: { active: true } }), db.asset.aggregate({ _count: true, _sum: { size: true } }), db.project.count({ where: { deletedAt: null } }), currentBibleVersion(),
    Promise.resolve(process.env.DATABASE_URL || 'file:./dev.db'),
  ]);
  const dbFile = path.resolve(process.cwd(), 'prisma', dbUrl.replace(/^file:/, ''));
  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-5">
        <Section title="Production Bible & prompt templates">
          <div className="flex flex-wrap gap-2"><Link href="/settings/bible" className="btn btn-primary">PRODUCTION BIBLE (v{bibleV})</Link><Link href="/templates" className="btn">PROMPT TEMPLATES ({tplCount})</Link></div>
          <p className="mt-2 text-sm text-neutral-500">Your permanent creative rules and the task templates behind every Production Brain prompt. Everything is stored in your local database and editable.</p>
        </Section>
        <Section title="Storage (local files)">
          <StorageRootForm current={s.storageRoot || DEFAULT_ROOT_LABEL} />
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="label">Resolved folder on this computer</dt><dd className="mono break-all">{root}</dd></div>
            <div><dt className="label">Database file (metadata, prompts, statuses, paths)</dt><dd className="mono break-all">{dbFile}</dd></div>
            <div><dt className="label">Files tracked</dt><dd>{assets._count} files · {((assets._sum.size ?? 0) / 1048576).toFixed(1)} MB · {projects} project(s)</dd></div>
            <div><dt className="label">Folder layout</dt><dd className="mono text-xs leading-5">Baby Chef Studio/<br />&nbsp;&nbsp;00 Baby Chefs/&lt;Name&gt;/References/…<br />&nbsp;&nbsp;&lt;Project Name&gt;/<br />&nbsp;&nbsp;&nbsp;&nbsp;01 References/(Baby, Kitchen, Products…)<br />&nbsp;&nbsp;&nbsp;&nbsp;02 Images · 03 Redos · 04 Kling<br />&nbsp;&nbsp;&nbsp;&nbsp;05 Prompts · 06 Publishing</dd></div>
          </dl>
          <p className="mt-3 text-sm text-neutral-500">Images are normal files you can open in Finder. One reference file is shared by every image that uses it (the database links to it — it is never copied). Back up the storage folder <b>and</b> the database file.</p>
        </Section>
        <DirtyForm action={saveSettings} className="space-y-5"><input type="hidden" name="_general" value="1" />
          <Section title="General">
            <div className="grid gap-3 sm:grid-cols-2">
              <Text name="appName" label="Application display name" v={s.appName} /><Text name="defaultAspect" label="Default aspect ratio" v={s.defaultAspect} />
              <Text name="defaultShortDuration" label="Default short duration" v={s.defaultShortDuration} /><Text name="defaultLongDuration" label="Default long-form duration" v={s.defaultLongDuration} />
              <Sel name="defaultProjectStatus" label="Default project status" v={s.defaultProjectStatus} options={PROJECT_STATUSES} />
              <div className="flex items-end"><Check name="defaultVerticalCrop" label="Vertical crop required by default" v={s.defaultVerticalCrop === 'true'} /></div>
            </div>
          </Section>
          <Section title="Production defaults"><Area name="principles" label="Default Baby Chef production principles (one per line)" v={s.principles} rows={14} hint="Also available as {{principles}} in prompt templates." /></Section>
          <Section title="External tool links (open in a new tab only — no automation)">
            <div className="grid gap-3 sm:grid-cols-2">{TOOL_NAMES.map(t => <Text key={t} name={`url_${t}`} label={t} v={s[`url_${t}`]} />)}</div>
            <p className="mt-2 text-xs text-neutral-500">Baby Chef Studio never stores passwords or logs in to any service.</p>
          </Section>
          <SubmitBtn>SAVE SETTINGS</SubmitBtn>
        </DirtyForm>
        <Section title="File naming conventions">
          <ul className="mono space-y-1 text-xs leading-6">
            <li>Scene: SC## (SC01, SC02…) · Image: IMG-### (global, IMG-001…) · Kling: KLING-## · Correction: COR-###</li>
            <li>Reference: REF-BABY-001_name_category.jpg · REF-KITCHEN-001… · REF-PRODUCT-001_grace-coconut-milk_front-label.jpg</li>
            <li>Generated: &lt;project-slug&gt;_SC12_IMG-024_attempt-v1.png (approved download name: …_approved-v2.png)</li>
            <li>Prompts: &lt;project-slug&gt;_SC12_IMG-024_full-prompt_v2.txt · &lt;project-slug&gt;_KLING-07_prompt_v1.txt</li>
            <li>Files are never overwritten: a changed file becomes _v2, a name clash becomes _dup2.</li>
          </ul>
        </Section>
      </div>
    </>
  );
}
