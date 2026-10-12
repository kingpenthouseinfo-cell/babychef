/** Plain-language labels shown in the interface. Technical values stay unchanged in the database and code. */
const STATUS: Record<string, string> = {
  PLANNED: 'Not started', 'PROMPT DRAFT': 'Prompt drafted', READY: 'Ready to make', GENERATING: 'Making', WAITING: 'Waiting',
  REVIEW: 'Check this', APPROVED: 'Looks good', REDO: 'Needs fixing', REJECTED: "Don't use", SKIPPED: 'Skip',
  DRAFT: 'Draft', ACTIVE: 'In progress', ARCHIVED: 'Put away', COMPLETE: 'Done', COMPLETED: 'Done', LOCKED: 'Locked',
  BLOCKED: 'Waiting for another step', UNMATCHED: 'Needs a home', 'IN PROGRESS': 'In progress',
};
export const statusWords = (s: string) => STATUS[s] ?? STATUS[s?.toUpperCase?.()] ?? s;

/** Which part of the project a "next step" belongs to, for colour and the NEXT · label. */
export function zoneOf(href: string): { label: string; zone: 'pink' | 'sage' | 'blue' | 'purple' } {
  if (href.includes('/questions')) return { label: 'Missing info', zone: 'sage' };
  if (href.includes('/kling')) return { label: 'Video clips', zone: 'purple' };
  if (href.includes('/publishing') || href.includes('/short')) return { label: 'Post video', zone: 'purple' };
  if (href.includes('/recipe') || href.includes('/ingredients')) return { label: 'Recipe', zone: 'blue' };
  if (href.includes('/scenes') || href.includes('/script')) return { label: 'Scenes', zone: 'blue' };
  return { label: 'Pictures', zone: 'pink' };
}
export const ZONE: Record<'pink' | 'sage' | 'blue' | 'purple', { bg: string; bd: string; ink: string; btn: string }> = {
  pink: { bg: 'linear-gradient(135deg,#FDECF1 0%,#F9EEF7 100%)', bd: '#F0CDDA', ink: '#9A4A64', btn: 'btn-accent' },
  sage: { bg: 'linear-gradient(135deg,#EAF4EC 0%,#F1F7E8 100%)', bd: '#CFE3D3', ink: '#4C6B52', btn: 'btn-approve' },
  blue: { bg: 'linear-gradient(135deg,#E9F1FC 0%,#EEEDFC 100%)', bd: '#C9D9EF', ink: '#3E6290', btn: 'btn-copy' },
  purple: { bg: 'linear-gradient(135deg,#F0EAFB 0%,#F7ECF4 100%)', bd: '#DDD0F2', ink: '#6A55A2', btn: 'btn-purple' },
};
