import { DirtyForm, SubmitBtn } from './client';
import { Area, Check, Sel, Text } from './ui';
import { saveScene } from '@/lib/actions/script';
import { ADULT_OPTIONS, CROP_LEVELS, SCENE_STATUSES, SHOT_TYPES } from '@/lib/constants';

export function SceneForm({ projectId, s }: { projectId: string; s?: any }) {
  return (
    <DirtyForm action={saveScene} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />{s && <input type="hidden" name="id" value={s.id} />}
      <div className="grid gap-3 sm:grid-cols-3"><Text name="title" label="Scene title *" v={s?.title} required className="sm:col-span-2" /><Sel name="status" label="Status" v={s?.status ?? 'PLANNED'} options={SCENE_STATUSES} /></div>
      <div className="grid gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 sm:grid-cols-3">
        <div className="sm:col-span-3 text-xs font-bold uppercase tracking-wide text-amber-900">Food-state continuity</div>
        <Area name="foodBefore" label="Food state BEFORE" v={s?.foodBefore} rows={3} /><Area name="foodDuring" label="Food state DURING" v={s?.foodDuring} rows={3} /><Area name="foodAfter" label="Food state AFTER" v={s?.foodAfter} rows={3} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Text name="recipeStep" label="Recipe step" v={s?.recipeStep} /><Text name="purpose" label="Purpose" v={s?.purpose} />
        <Area name="narrative" label="Narrative description" v={s?.narrative} /><Area name="dialogue" label="Dialogue" v={s?.dialogue} />
        <Area name="babyReaction" label="Baby reaction" v={s?.babyReaction} rows={2} /><Area name="mainAction" label="Main action" v={s?.mainAction} rows={2} />
        <Area name="secondaryAction" label="Secondary action" v={s?.secondaryAction} rows={2} /><Text name="ingredients" label="Ingredient(s)" v={s?.ingredients} />
        <Text name="utensils" label="Utensil(s)" v={s?.utensils} /><Text name="cookware" label="Cookware" v={s?.cookware} />
        <Text name="babyPosition" label="Baby position" v={s?.babyPosition} /><Sel name="adultAssist" label="Adult assistance" v={s?.adultAssist ?? 'NO'} options={ADULT_OPTIONS} />
        <Area name="adultNotes" label="Adult assistance notes" v={s?.adultNotes} rows={2} /><Area name="safetyNotes" label="Safety notes" v={s?.safetyNotes} rows={2} />
        <Text name="cameraAngle" label="Camera angle" v={s?.cameraAngle} /><Text name="cameraMovement" label="Camera movement" v={s?.cameraMovement} />
        <Sel name="shotPriority" label="Shot priority" v={s?.shotPriority ?? SHOT_TYPES[0]} options={SHOT_TYPES} />
        <Sel name="cropImportance" label="Vertical crop importance" v={s?.cropImportance ?? 'PREFERRED'} options={CROP_LEVELS} hint="CRITICAL: keep subjects in the central ~55–60% of frame." />
        <Area name="asmr" label="ASMR" v={s?.asmr} rows={2} /><Area name="continuity" label="Continuity requirements" v={s?.continuity} rows={2} />
        <Area name="notes" label="Notes" v={s?.notes} rows={2} className="sm:col-span-2" />
      </div>
      <div className="flex flex-wrap gap-5"><Check name="shortKeep" label="SHORT KEEP" v={s?.shortKeep} /><Check name="hook" label="HOOK" v={s?.hook} /><Check name="beauty" label="Beauty shot" v={s?.beauty} /></div>
      <SubmitBtn>{s ? 'SAVE SCENE' : 'ADD SCENE'}</SubmitBtn>
    </DirtyForm>
  );
}
