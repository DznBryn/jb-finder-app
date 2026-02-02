import type { Dispatch, SetStateAction, FormEvent } from "react";
import type { ButtonProps } from "@/components/ui/button";
import type React from "react";

// Industry choices for filtering
export const INDUSTRY_OPTIONS = [
  { value: "all", label: "All Industries" },
  { value: "fintech", label: "Fintech" },
  { value: "ai", label: "AI / Machine Learning" },
  { value: "developer-tools", label: "Developer Tools" },
  { value: "productivity", label: "Productivity" },
  { value: "marketplace", label: "Marketplace" },
  { value: "delivery", label: "Delivery / Logistics" },
  { value: "social-media", label: "Social Media" },
  { value: "hr-tech", label: "HR Tech" },
  { value: "saas", label: "SaaS" },
  { value: "security", label: "Security" },
  { value: "healthcare", label: "Healthcare" },
  { value: "consumer", label: "Consumer Products" },
  { value: "logistics", label: "Logistics" },
  { value: "aerospace", label: "Aerospace" },
  { value: "agency", label: "Agency / Services" },
  { value: "nonprofit", label: "Nonprofit" },
] as const;

export type IndustryValue = typeof INDUSTRY_OPTIONS[number]["value"];

export type SessionProfile = {
  session_id: string;
  resume_s3_key: string | null;
  extracted_skills: string[];
  inferred_titles: string[];
  seniority: string;
  years_experience: number;
  location_pref: string | null;
  remote_pref: boolean | null;
  llm_summary: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  social_links: string[];
  created_at: string;
  expires_at: string;
};

export type AnalyzeResult = {
  job_id: string;
  grade: string;
  rationale: string;
  missing_skills: string[];
};

export type LearningResource = {
  title: string;
  type: string;
  url?: string | null;
  notes?: string | null;
};

export type LearningResourceGroup = {
  skill: string;
  category: string;
  relevant: boolean;
  summary?: string | null;
  resources: LearningResource[];
};

export type DeepAnalyzeResponse = {
  session_id: string;
  job_id: string;
  grade: string;
  rationale: string;
  missing_skills: string[];
  learning_resources: LearningResourceGroup[];
};

export type ResumeTextResponse = {
  session_id: string;
  resume_text: string;
};

export type ResumeReviewResponse = {
  session_id: string;
  job_id: string;
  summary: string;
  strengths: string[];
  gaps: string[];
  missing_required_skills: string[];
  changes: string[];
  rewording: string[];
  vocabulary: string[];
};

export type CoverLetterVersion = {
  id: number;
  document_id: number;
  job_id: string;
  content: string;
  created_at: string;
  created_by: string;
  intent?: string | null;
  base_hash?: string | null;
  result_hash?: string | null;
};

export type CoverLetterDocumentResponse = {
  document_id: number;
  session_id: string;
  job_id: string;
  draft_content: string;
  draft_hash: string;
  current_version_id?: number | null;
  versions: CoverLetterVersion[];
};

export type CoverLetterDraftResponse = {
  document_id: number;
  session_id: string;
  job_id: string;
  draft_content: string;
  draft_hash: string;
  updated_at: string;
};

export type CoverLetterSuggestResponse = {
  base_hash: string;
  ops: Array<{
    type: "replace" | "insert" | "delete";
    start?: number;
    end?: number;
    pos?: number;
    text?: string;
  }>;
  preview: string;
  diff: string;
  explanation: string;
  warnings: string[];
};

export type AnalyzedJobDetail = {
  job_id: string;
  title: string;
  company: string;
  location: string;
  apply_url: string;
};

export type SessionContextValue = {
  sessionProfile: SessionProfile | null;
  setSessionProfile: Dispatch<SetStateAction<SessionProfile | null>>;
  selectedJobs: string[];
  setSelectedJobs: Dispatch<SetStateAction<string[]>>;
  analysisResults: Record<string, AnalyzeResult | null>;
  setAnalysisResults: Dispatch<
    SetStateAction<Record<string, AnalyzeResult | null>>
  >;
  analysisBest: string | null;
  setAnalysisBest: Dispatch<SetStateAction<string | null>>;
  analyzedJobIds: string[];
  setAnalyzedJobIds: Dispatch<SetStateAction<string[]>>;
  analyzedJobDetails: Record<string, AnalyzedJobDetail>;
  setAnalyzedJobDetails: Dispatch<
    SetStateAction<Record<string, AnalyzedJobDetail>>
  >;
};

export type MatchResult = {
  job_id: string;
  company: string;
  title: string;
  location: string;
  industry?: string | null;
  pay_ranges: Array<{
    min_cents?: number;
    max_cents?: number;
    currency_type?: string;
    title?: string;
    blurb?: string;
  }>;
  is_active?: boolean;
  score: number;
  tier: string;
  reasons: string[];
  missing_skills: string[];
  apply_url: string;
};

export type SelectionResponse = {
  accepted_job_ids: string[];
  rejected_job_ids: string[];
};

export type ApplyResult = {
  cover_letter_text: string | null;
  apply_url: string;
};

export type MatchFilters = {
  title_terms: string[];
  location_pref: string | null;
  work_mode: string | null;
  pay_range: string | null;
  industry: string | null;
};

export type UploadResumeProps = {
  uploading: boolean;
  errorMessage: string | null;
  sessionProfile: SessionProfile | null;
  onUpload: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export type MatchesSectionProps = {
  matchesError: string | null;
  hasLoadedMatches: boolean;
  loadingMatches: boolean;
  matches: MatchResult[];
  matchesPage: number;
  matchesTotal: number;
  matchesPageSize: number;
  activeFilters: MatchFilters | null;
  filterTitleTerms: string;
  filterLocation: string;
  filterWorkMode: string;
  filterPayRange: string;
  filterIndustry: string;
  onFilterTitleTermsChange: (value: string) => void;
  onFilterLocationChange: (value: string) => void;
  onFilterWorkModeChange: (value: string) => void;
  onFilterPayRangeChange: (value: string) => void;
  onFilterIndustryChange: (value: string) => void;
  onApplyFilters: () => Promise<void>;
  onFetchMatches: (page: number, filters: MatchFilters | null) => Promise<void>;
  selectedJobs: string[];
  unanalyzedSelected: string[];
  analyzedJobIds: string[];
  analyzedJobDetails: Record<string, AnalyzedJobDetail>;
  analysisResults: Record<string, AnalyzeResult | null>;
  analysisBest: string | null;
  analyzing: boolean;
  analysisProgress: {
    current: number;
    total: number;
    percent: number;
  } | null;
  selectionError: string | null;
  analysisError: string | null;
  selectionResult: SelectionResponse | null;
  applyTone: string;
  applyResults: Record<string, ApplyResult | null>;
  onAnalyzeSelections: () => Promise<void>;
  onSelectAllVisible: () => void;
  onDeselectAll: () => void;
  onSaveSelections: () => Promise<void>;
  onToggleJobSelection: (jobId: string) => void;
  onApplyToneChange: (value: string) => void;
  onPrepareApply: (jobId: string) => Promise<void>;
};

export type SelectedJob = {
  job_id: string;
  company: string;
  title: string;
  location: string;
  apply_url: string;
  is_active?: boolean;
  industry?: string | null;
};

export type GreenhouseFieldValue = { value: number | string; label: string };

export type GreenhouseField = {
  name: string;
  type: string;
  values?: GreenhouseFieldValue[];
};

export type GreenhouseQuestion = {
  required?: boolean;
  label: string;
  fields: GreenhouseField[];
};

export type GreenhouseJob = {
  id: number;
  title: string;
  location?: { name?: string } | null;
  absolute_url?: string;
  content?: string;
  questions?: GreenhouseQuestion[];
  location_questions?: GreenhouseQuestion[];
  pay_input_ranges?: Array<{
    min_cents?: number;
    max_cents?: number;
    currency_type?: string;
    title?: string;
    blurb?: string;
  }>;
  data_compliance?: Array<{
    type: string;
    requires_consent?: boolean;
    requires_processing_consent?: boolean;
    requires_retention_consent?: boolean;
  }>;
  demographic_questions?: {
    header?: string;
    description?: string;
    questions?: Array<{
      id: number;
      label: string;
      required?: boolean;
      type: string;
      answer_options: Array<{ id: number; label: string; free_form?: boolean }>;
    }>;
  };
};

export type JobFormState = {
  fields: Record<string, string | string[] | null>;
  compliance: Record<string, boolean>;
  demographics: Record<
    string,
    {
      selected: number[] | number | null;
      text?: string;
    }
  >;
};

export type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<ButtonProps, "size"> &
  React.ComponentProps<"a">;
