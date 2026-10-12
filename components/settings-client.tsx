'use client';
import { useFormState } from 'react-dom';
import { SubmitBtn } from './client';
import { saveStorageRoot } from '@/lib/actions/settings';

export function StorageRootForm({ current }: { current: string }) {
  const [state, action] = useFormState(saveStorageRoot, { ok: true, message: '' });
  return (
    <form action={action} className="space-y-2">
      <label className="block"><span className="label">Storage root folder</span><input name="root" defaultValue={current} className="input mono" /></label>
      <SubmitBtn pendingText="Checking…">SAVE STORAGE ROOT</SubmitBtn>
      {state.message && <p className={`text-sm ${state.ok ? 'text-green-800' : 'text-red-700'}`} role="status">{state.message}</p>}
    </form>
  );
}
