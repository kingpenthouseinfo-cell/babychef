'use client';
import { useState } from 'react';
import { CopyButton, SubmitBtn } from './client';
import { saveProjectPrompt, applyPrompt } from '@/lib/actions/prompts';

export function LivePromptForm({ projectId, templateId, category, initial, name, imageId, klingId }: { projectId: string; templateId: string; category: string; initial: string; name: string; imageId?: string; klingId?: string }) {
  const [t, setT] = useState(initial);
  return (
    <form action={saveProjectPrompt}>
      <input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="templateId" value={templateId} /><input type="hidden" name="category" value={category} />
      <textarea name="text" value={t} onChange={e => setT(e.target.value)} rows={20} className="input mono" aria-label="Final assembled prompt" />
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <CopyButton text={t} label="COPY PROMPT" />
        <input name="name" defaultValue={name} className="input max-w-xs" aria-label="Name for saved prompt" />
        <SubmitBtn className="" pendingText="Saving…">SAVE AS PROJECT PROMPT</SubmitBtn>
        {imageId && <>
          <button type="submit" formAction={applyPrompt} name="target" value="image-full" className="btn"><input type="hidden" name="targetId" value={imageId} />SAVE AS IMAGE FULL PROMPT</button>
        </>}
        {klingId && <button type="submit" formAction={applyPrompt} name="target" value="kling" className="btn">SAVE AS KLING PROMPT</button>}
      </div>
      {imageId && <input type="hidden" name="targetId" value={imageId} />}
      {klingId && !imageId && <input type="hidden" name="targetId" value={klingId} />}
    </form>
  );
}
