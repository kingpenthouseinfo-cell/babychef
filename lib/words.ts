/** Plain-language labels shown in the interface. Technical values stay unchanged in the database and code. */
const STATUS: Record<string, string> = {
  PLANNED: 'Not started', 'PROMPT DRAFT': 'Prompt drafted', READY: 'Ready to make', GENERATING: 'Making', WAITING: 'Waiting',
  REVIEW: 'Check this', APPROVED: 'Looks good', REDO: 'Needs fixing', REJECTED: "Don't use", SKIPPED: 'Skip',
  DRAFT: 'Draft', ACTIVE: 'In progress', ARCHIVED: 'Put away', COMPLETE: 'Done', COMPLETED: 'Done', LOCKED: 'Locked',
  BLOCKED: 'Waiting for another step', UNMATCHED: 'Needs a home', 'IN PROGRESS': 'In progress',
};
export const statusWords = (s: string) => STATUS[s] ?? STATUS[s?.toUpperCase?.()] ?? s;
