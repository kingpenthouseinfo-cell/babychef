import Link from 'next/link';
import { addPictureHere, addSceneHere, movePictureUpDown, moveSceneUpDown, duplicatePicture, duplicateScene, deleteSceneHere, splitScene, resolveNotice } from '@/lib/actions/insert';
import { SubmitBtn, ConfirmForm } from './client';

const hid = (name: string, value: string) => <input type="hidden" name={name} value={value} />;

/** + ADD PICTURE HERE — one text box is enough; details are optional. */
export function InsertPicture({ projectId, sceneId, afterImageId, label = '+ ADD PICTURE HERE', quick = false }: { projectId: string; sceneId: string; afterImageId: string; label?: string; quick?: boolean }) {
  return (
    <details className="group my-1">
      <summary className="inline-flex cursor-pointer list-none items-center rounded-full border border-dashed border-line px-3 py-1 text-[12px] font-semibold text-ink-secondary hover:border-ink/40 hover:text-ink">{label}</summary>
      <form action={addPictureHere} className="mt-2 space-y-2 rounded-lg border border-line bg-surface p-3">
        {hid('projectId', projectId)}{hid('sceneId', sceneId)}{hid('afterImageId', afterImageId)}
        <label className="block"><span className="label">{quick ? 'Describe the extra picture' : 'What picture do you need?'}</span>
          <input name="title" required className="input" placeholder="e.g. Close-up of the butter being rubbed into the flour" /></label>
        {!quick && <label className="block"><span className="label">What should happen in the picture? (optional)</span><textarea name="what" rows={2} className="input" /></label>}
        <SubmitBtn className="btn-primary btn-sm" pendingText="Adding…">{quick ? 'ADD' : 'ADD PICTURE'}</SubmitBtn>
      </form>
    </details>
  );
}

/** + ADD SCENE HERE (before or after a scene). */
export function InsertScene({ projectId, afterSceneId, beforeSceneId, label = '+ ADD SCENE HERE' }: { projectId: string; afterSceneId?: string; beforeSceneId?: string; label?: string }) {
  return (
    <details className="my-2">
      <summary className="inline-flex cursor-pointer list-none items-center rounded-full border border-line-strong bg-white px-3.5 py-1 text-[12.5px] font-medium text-ink-secondary hover:border-ink/40 hover:text-ink">{label}</summary>
      <form action={addSceneHere} className="mt-2 grid gap-2 rounded-lg border border-line bg-surface p-3 sm:grid-cols-2">
        {hid('projectId', projectId)}{afterSceneId && hid('afterSceneId', afterSceneId)}{beforeSceneId && hid('beforeSceneId', beforeSceneId)}
        <label className="block sm:col-span-2"><span className="label">Scene name</span><input name="title" required className="input" placeholder="e.g. Roll the dough" /></label>
        <label className="block sm:col-span-2"><span className="label">What happens?</span><textarea name="narrative" rows={2} className="input" /></label>
        <label className="block"><span className="label">Dialogue (optional)</span><input name="dialogue" className="input" /></label>
        <label className="block"><span className="label">Notes (optional)</span><input name="notes" className="input" /></label>
        <div className="sm:col-span-2"><SubmitBtn className="btn-primary btn-sm" pendingText="Adding…">ADD SCENE</SubmitBtn></div>
      </form>
    </details>
  );
}

const Item = ({ children }: { children: React.ReactNode }) => <div className="px-1">{children}</div>;
const menuBtn = 'flex min-h-[36px] w-full items-center rounded-md px-3 text-left text-[13px] hover:bg-sunken';

/** "…" menu on a scene card. */
export function SceneMenu({ projectId, scene, images, first, last }: { projectId: string; scene: { id: string; title: string }; images: { id: string; label: string }[]; first: boolean; last: boolean }) {
  return (
    <details className="relative">
      <summary className="btn btn-sm btn-ghost list-none" aria-label={`Scene menu: ${scene.title}`}>…</summary>
      <div className="absolute right-0 z-30 mt-1 w-60 rounded-lg border border-line bg-surface p-1.5 shadow-md">
        <div className="px-1"><InsertPicture projectId={projectId} sceneId={scene.id} afterImageId="START" label="Add picture before" /></div>
        <div className="px-1"><InsertPicture projectId={projectId} sceneId={scene.id} afterImageId="" label="Add picture after" /></div>
        <div className="px-1"><InsertScene projectId={projectId} beforeSceneId={scene.id} label="Add scene before" /></div>
        <div className="px-1"><InsertScene projectId={projectId} afterSceneId={scene.id} label="Add scene after" /></div>
        <form action={duplicateScene}>{hid('id', scene.id)}<button className={menuBtn}>Duplicate</button></form>
        {!first && <form action={moveSceneUpDown}>{hid('id', scene.id)}{hid('dir', 'up')}<button className={menuBtn}>Move up</button></form>}
        {!last && <form action={moveSceneUpDown}>{hid('id', scene.id)}{hid('dir', 'down')}<button className={menuBtn}>Move down</button></form>}
        {images.length > 1 && (
          <details className="px-1"><summary className={`${menuBtn} cursor-pointer list-none`}>Split this scene…</summary>
            <form action={splitScene} className="space-y-1 px-2 py-1 text-[13px]">{hid('id', scene.id)}
              <div className="text-[12px] text-ink-secondary">Tick the pictures that belong in the second half:</div>
              {images.map(i => <label key={i.id} className="flex items-center gap-2"><input type="checkbox" name="img" value={i.id} className="accent-[#4C6B52]" />{i.label}</label>)}
              <SubmitBtn className="btn-sm" pendingText="Splitting…">SPLIT SCENE HERE</SubmitBtn></form></details>
        )}
        <ConfirmForm action={deleteSceneHere} message={`Delete scene "${scene.title}"? (It must have no pictures.)`}>{hid('id', scene.id)}<button className={`${menuBtn} text-[#A8513F]`}>Delete</button></ConfirmForm>
      </div>
    </details>
  );
}

export function PictureMenu({ id, first, last, href, code, projectId, sceneId }: { id: string; first: boolean; last: boolean; href: string; code?: string; projectId?: string; sceneId?: string }) {
  return (
    <details className="relative">
      <summary className="btn btn-sm btn-ghost list-none" aria-label="Picture menu">…</summary>
      <div className="absolute right-0 z-30 mt-1 w-48 rounded-lg border border-line bg-surface p-1.5 shadow-md">
        {code && <div className="px-3 py-1 font-mono text-[11px] text-ink-muted">{code}</div>}
        <Link className={menuBtn} href={href}>Open details</Link>
        {projectId && sceneId && <><div className="px-1"><InsertPicture projectId={projectId} sceneId={sceneId} afterImageId={id} label="Add picture after" /></div><div className="px-1"><InsertPicture projectId={projectId} sceneId={sceneId} afterImageId={id} label="Quick add after" quick /></div></>}
        {!first && <form action={movePictureUpDown}>{hid('id', id)}{hid('dir', 'up')}<button className={menuBtn}>Move up</button></form>}
        {!last && <form action={movePictureUpDown}>{hid('id', id)}{hid('dir', 'down')}<button className={menuBtn}>Move down</button></form>}
        <form action={duplicatePicture}>{hid('id', id)}<button className={menuBtn}>Duplicate</button></form>
      </div>
    </details>
  );
}

export function NoticeCard({ projectId, id, text, yes, no }: { projectId: string; id: string; text: string; yes: string; no: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#E7D3A0] bg-[#F8EFD9] p-3 text-[13px] text-[#6F4E10]">
      <span className="min-w-0 flex-1">{text}</span>
      <form action={resolveNotice}>{hid('projectId', projectId)}{hid('noticeId', id)}{hid('yes', '1')}<button className="btn btn-sm btn-primary">{yes}</button></form>
      <form action={resolveNotice}>{hid('projectId', projectId)}{hid('noticeId', id)}{hid('yes', '0')}<button className="btn btn-sm">{no}</button></form>
    </div>
  );
}
void Item;

/** Dashed "Add picture here" tile at the end of a scene's pictures. */
export function InsertTile({ projectId, sceneId, afterImageId }: { projectId: string; sceneId: string; afterImageId: string }) {
  return (
    <details className="group rounded-[14px] border border-dashed border-line-strong open:col-span-2 open:border-solid open:p-3">
      <summary className="flex min-h-[150px] cursor-pointer list-none flex-col items-center justify-center gap-1 text-[13.5px] text-ink-secondary group-open:min-h-0 group-open:items-start"><span className="text-[18px] leading-none">+</span><span>Add picture here</span></summary>
      <form action={addPictureHere} className="mt-2 space-y-2">
        {hid('projectId', projectId)}{hid('sceneId', sceneId)}{hid('afterImageId', afterImageId)}
        <label className="block"><span className="label">What picture do you need?</span><input name="title" required className="input" placeholder="e.g. Close-up of the butter being rubbed into the flour" /></label>
        <label className="block"><span className="label">What should happen in the picture? (optional)</span><textarea name="what" rows={2} className="input" /></label>
        <SubmitBtn className="btn-primary btn-sm" pendingText="Adding…">Add picture</SubmitBtn>
      </form>
    </details>
  );
}
