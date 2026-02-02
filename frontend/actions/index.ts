'use server';

// Resume actions
export {
  uploadResume,
  getResumeText,
  reviewResume,
} from './resume';

// Matches actions
export { fetchMatches } from './matches';
export type { FetchMatchesResponse } from './matches';

// Jobs actions
export {
  getJobDetails,
  selectJobs,
  getSelectedJobDetails,
} from './jobs';
export type { SelectedJobsResponse } from './jobs';

// Analyze actions
export {
  analyzeJobs,
  getDeepAnalysis,
  runDeepAnalysis,
} from './analyze';
export type { AnalyzeJobsResponse } from './analyze';

// Apply actions
export {
  prepareApply,
  submitApplication,
} from './apply';
export type { DemographicAnswer, SubmitApplicationParams } from './apply';

// Editor actions
export {
  loadDocument,
  saveDraft,
  suggestContent,
  saveVersion,
} from './editor';
export type { SaveDraftResponse } from './editor';

// Session actions
export {
  getSessionProfile,
  convertSession,
} from './session';
