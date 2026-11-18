// Client for the FastAPI backend, used from the Next.js server. It never throws: failures
// come back as { ok: false } so pages show an honest error state instead of crashing or
// showing invented data.

export type DependencyCheck = { ok: boolean; error?: string };

export type Readiness = {
  status: "ok" | "degraded";
  checks: Record<string, DependencyCheck>;
  provider_mode: "sample" | "live";
  environment: string;
};

export type ApiError = {
  ok: false;
  error: string;
  code?: string;
  details?: Record<string, unknown>;
  httpStatus?: number;
};

export type ApiResult<T> = { ok: true; data: T; httpStatus: number } | ApiError;

export function backendUrl(): string {
  return (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/+$/, "");
}

type ErrorBody = { error?: { message?: string; code?: string; details?: Record<string, unknown> } };

export async function fetchJson<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
  fetchImpl: typeof fetch = fetch,
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init?.timeoutMs ?? 8000);
  try {
    const res = await fetchImpl(`${backendUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.status === 204) return { ok: true, data: null as T, httpStatus: 204 };
    const body = (await res.json().catch(() => null)) as unknown;
    // /health/ready legitimately returns a JSON body with 503 when degraded.
    const isReadiness = path.startsWith("/health/ready") && res.status === 503;
    if (body !== null && (res.ok || isReadiness)) {
      return { ok: true, data: body as T, httpStatus: res.status };
    }
    const err = (body as ErrorBody | null)?.error;
    const out: ApiError = { ok: false, error: err?.message ?? `HTTP ${res.status}`, httpStatus: res.status };
    if (err?.code) out.code = err.code;
    if (err?.details) out.details = err.details;
    return out;
  } catch (err) {
    const reason = err instanceof Error && err.name === "AbortError" ? "timed out" : "unreachable";
    return { ok: false, error: `Backend ${reason}` };
  } finally {
    clearTimeout(timer);
  }
}

export function getReadiness(fetchImpl?: typeof fetch) {
  return fetchJson<Readiness>("/health/ready", undefined, fetchImpl);
}

// ---- Response types
export type AuditEntry = {
  id: number;
  occurred_at: string;
  actor: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
};

export type ProviderStatus = {
  capability: string;
  provider: string;
  is_sample: boolean;
  configured: boolean;
  detail: string;
};

export type Overview = {
  provider_mode: "sample" | "live";
  environment: string;
  jobs: Record<string, number>;
  budget: {
    month_start: string;
    spent_usd: string;
    limit_usd: string;
    alert_threshold_percent: number;
    used_percent: number | null;
  };
  audit: { ok: boolean; entries: number };
  recent_activity: AuditEntry[];
  providers: ProviderStatus[];
  setup_checklist: { key: string; done: boolean }[];
  rights: Record<"active" | "draft" | "expiring_soon" | "expired" | "revoked" | "not_yet_effective", number>;
};

export type SettingKind = "decimal" | "int" | "bool" | "choice";

export type SettingItem = {
  key: string;
  category: string;
  kind: SettingKind;
  value: string | number | boolean;
  default: string | number | boolean;
  is_default: boolean;
  description: string;
  minimum: string | null;
  maximum: string | null;
  choices: string[];
  unit: string | null;
  spending_limit: boolean;
  updated_by: string | null;
  updated_at: string | null;
};

export type User = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  preferred_language: "en" | "yo";
};

// ---- Phase 3: discovery and research
export type Channel = {
  id: string;
  platform: string;
  external_id: string;
  title: string;
  handle: string | null;
  authorisation_basis: "research_only" | "licensed";
  authorisation_note: string;
  authorised_by: string;
  authorised_at: string;
  is_active: boolean;
  is_sample: boolean;
  episode_count: number;
  last_scanned_at: string | null;
};

export type EpisodeStatus = "discovered" | "researched" | "archived";

export type EpisodeSummary = {
  id: string;
  channel_id: string;
  channel_title: string;
  platform: string;
  external_id: string;
  title: string;
  published_at: string;
  duration_seconds: number | null;
  url: string;
  thumbnail_url: string | null;
  has_captions: boolean | null;
  status: EpisodeStatus;
  is_sample: boolean;
  possible_duplicate_of_id: string | null;
  has_transcript: boolean;
};

export type ReportStatus = "pending" | "completed" | "failed" | "blocked";
export type TopicStatus = "proposed" | "approved" | "rejected";

export type TopicItem = {
  id: string;
  report_id: string;
  title: string;
  description: string;
  audience_fit: string | null;
  lesson_angle: string | null;
  status: TopicStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  is_sample: boolean;
};

export type ReportSummary = {
  id: string;
  episode_id: string | null;
  subject: string;
  status: ReportStatus;
  provider: string | null;
  model: string | null;
  is_sample: boolean;
  cost_usd: string;
  overlap_flagged: boolean;
  max_verbatim_overlap_words: number;
  used_transcript: boolean;
  error: string | null;
  job_id: string | null;
  requested_by: string;
  created_at: string;
  topic_count: number;
};

export type ReportDetail = ReportSummary & {
  summary: string | null;
  key_concepts: { name: string; explanation: string }[];
  nigerian_context: string | null;
  cautions: string[];
  input_tokens: number;
  output_tokens: number;
  topics: TopicItem[];
};

export type EpisodeDetail = EpisodeSummary & {
  description: string;
  transcript: {
    language: string;
    source: "licensor_provided" | "owner_entered" | "official_api";
    permission_reference: string;
    word_count: number;
    added_by: string;
    created_at: string;
  } | null;
  reports: ReportSummary[];
};

export type JobInfo = {
  id: string;
  task_name: string;
  status: "queued" | "running" | "succeeded" | "failed" | "blocked";
  error: string | null;
  result: Record<string, unknown> | null;
};

// ---- Phase 4: rights
export type GrantState = "granted" | "not_granted" | "unclear";
export type RightName = "translation" | "adaptation" | "commercial" | "distribution";
export type LicenceState = "draft" | "active" | "expired" | "revoked" | "not_yet_effective";
export type Reason = { code: string; [k: string]: unknown };

export type LicenceSummary = {
  id: string;
  licence_reference: string;
  licensor_name: string;
  status: "draft" | "verified" | "revoked";
  state: LicenceState;
  effective_from: string;
  expires_at: string;
  translation: GrantState;
  adaptation: GrantState;
  commercial: GrantState;
  distribution: GrantState;
  permitted_platforms: string[];
  permitted_languages: string[];
  channel_id: string | null;
  channel_title: string | null;
  episode_count: number;
  has_document: boolean;
  verified_by: string | null;
  verified_at: string | null;
  updated_at: string;
};

export type LicenceDetail = LicenceSummary & {
  licensor_contact: string | null;
  description: string | null;
  signed_on: string | null;
  territory: string | null;
  attribution_required: boolean;
  attribution_text: string | null;
  episodes: { id: string; title: string; is_sample: boolean }[];
  document: { filename: string; size: number; sha256: string; content_type: string } | null;
  problems: string[];
  revoked_by: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_by: string;
};

export type RightsSummary = Record<"active" | "draft" | "expiring_soon" | "expired" | "revoked" | "not_yet_effective", number>;

export type RightsDecision = {
  allowed: boolean;
  purpose: "adaptation" | "publish";
  platform: string | null;
  licence_id: string | null;
  reasons: Reason[];
  is_sample: boolean;
};

export type RightsCheckRow = RightsDecision & { id: string; episode_id: string | null; checked_by: string; checked_at: string };

export type OriginalityResult = {
  flag_words: number;
  flagged: boolean;
  matches: { episode_id: string; episode_title: string; used_transcript: boolean; words: number; excerpt: string; flagged: boolean }[];
};

// ---- Phase 5: Yoruba scripts
export type ScriptStatus = "generating" | "draft" | "in_review" | "changes_requested" | "approved" | "blocked" | "archived";
export type ScriptKind = "original_lesson" | "licensed_adaptation";
export type Issue = { code: string; [k: string]: unknown };
export type Segment = { id: string; text_yo: string; text_en: string; visual: string; locked?: boolean };

export type ScriptSummary = {
  id: string;
  kind: ScriptKind;
  format: "long_form" | "short";
  status: ScriptStatus;
  title_en: string;
  title_yo: string | null;
  topic_id: string | null;
  episode_id: string | null;
  licence_id: string | null;
  target_minutes: number;
  is_sample: boolean;
  current_revision: number;
  approved_revision: number | null;
  approved_at: string | null;
  blocked_reason: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  score: number | null;
  error_count: number;
};

export type Revision = {
  number: number;
  origin: "generated" | "revised" | "human_edit";
  title_yo: string;
  segments: Segment[];
  change_note: string | null;
  quality: { score: number; errors: Issue[]; warnings: Issue[]; stats: Record<string, number>; disclaimer: string };
  originality: { flagged: boolean; words: number; excerpt: string; episode_id: string | null } | null;
  provider: string | null;
  model: string | null;
  cost_usd: string;
  is_sample: boolean;
  created_by: string;
  created_at: string;
  estimated_seconds: number;
};

export type ScriptDetail = ScriptSummary & {
  revision: Revision | null;
  revisions: { number: number; origin: Revision["origin"]; created_by: string; created_at: string; score: number; change_note: string | null }[];
  reviews: { revision_number: number; reviewer: string; decision: "approved" | "changes_requested"; checklist: Record<string, boolean>; comments: string | null; created_at: string }[];
  checklist_items: string[];
  quality_disclaimer: string;
};

export type GlossaryTerm = { id: string; english: string; yoruba: string; notes: string | null; status: "proposed" | "approved"; approved_by: string | null };
export type PronEntry = { id: string; written: string; spoken: string; category: string; notes: string | null; status: "proposed" | "approved"; approved_by: string | null };
export type TeamMember = { id: string; email: string; display_name: string; role: string; is_active: boolean; last_login_at: string | null };

// ---- Phase 6: voice & presenter
export type Presenter = {
  id: string;
  name: string;
  description: string;
  voice_provider: string;
  voice_id: string;
  voice_model: string;
  voice_settings: Record<string, number>;
  has_portrait: boolean;
  portrait_sha256: string | null;
  voice_is_original_or_licensed: boolean;
  portrait_is_original_or_licensed: boolean;
  not_a_real_person: boolean;
  status: "draft" | "approved";
  approved_by: string | null;
  approved_at: string | null;
  voice_config_hash: string;
  passed_test_id: string | null;
  problems: string[];
  updated_at: string;
};

export type VoiceTest = {
  id: string;
  status: "generating" | "awaiting_review" | "passed" | "failed" | "blocked";
  passage: { id: string; text: string; checks: string[] }[];
  audio_asset_id: string | null;
  ratings: Record<string, boolean>;
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  provider: string | null;
  characters: number;
  cost_usd: string;
  is_sample: boolean;
  error: string | null;
  job_id: string | null;
  voice_config_hash: string;
  created_at: string;
  checks: string[];
};

export type Asset = { id: string; kind: string; position: number; mime_type: string; size_bytes: number; sha256: string; duration_seconds: number | null; is_sample: boolean };

export type ProductionRun = {
  id: string;
  script_id: string;
  script_revision: number;
  video_format: string;
  status: "queued" | "running" | "completed" | "failed" | "blocked";
  tts_provider: string | null;
  tts_characters: number;
  tts_cost_usd: string;
  avatar_seconds: number;
  avatar_cost_usd: string;
  total_cost_usd: string;
  duration_seconds: number;
  is_sample: boolean;
  error: string | null;
  job_id: string | null;
  requested_by: string;
  created_at: string;
  finished_at: string | null;
  segment_durations?: number[];
  assets?: Asset[];
};

export type GateCheck = { code: string; ok: boolean; blocking: boolean; detail: unknown };
export type ValueReport = { passed: boolean; checks: GateCheck[]; note: string };
export type RenderStatus = "queued" | "rendering" | "awaiting_approval" | "approved" | "rejected" | "failed" | "blocked";

export type VideoRender = {
  id: string;
  run_id: string;
  script_id: string;
  script_revision: number;
  title_en: string | null;
  title_yo: string | null;
  status: RenderStatus;
  formats: string[];
  platforms: Record<string, boolean>;
  long_seconds: number | null;
  vertical_seconds: number | null;
  vertical_is_full: boolean;
  is_sample: boolean;
  error: string | null;
  job_id: string | null;
  requested_by: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_notes: string | null;
  created_at: string;
  finished_at: string | null;
  value_report?: ValueReport;
  checks?: GateCheck[];
  review_checklist?: Record<string, boolean>;
  checklist_items?: string[];
  assets?: Asset[];
  cost?: { script_usd: string; voice_usd: string; render_usd: string; total_usd: string };
};

export type VideoList = {
  videos: VideoRender[];
  approved_count: number;
  required_approved: number;
  platform_rules: Record<string, { format: string; max_seconds: number }>;
};

export type RenderCandidate = {
  run: ProductionRun;
  title_yo: string | null;
  title_en: string;
  format: "long_form" | "short";
  value_report: ValueReport;
};

export type PlatformAccount = {
  id: string;
  platform: "youtube" | "facebook" | "instagram" | "tiktok";
  oauth_provider: "google" | "meta" | "tiktok";
  external_id: string;
  display_name: string;
  status: "connected" | "expired" | "disconnected";
  is_sample: boolean;
  scopes: string[];
  token_expires_at: string | null;
  has_refresh_token: boolean;
  last_refreshed_at: string | null;
  last_error: string | null;
  connected_by: string;
  created_at: string;
};

export type AccountsList = {
  accounts: PlatformAccount[];
  sample_mode: boolean;
  oauth_configured: string[];
  token_encryption_configured: boolean;
  public_media_configured: boolean;
  redirect_uris: Record<string, string>;
};

export type PublicationStatus = "scheduled" | "uploading" | "retrying" | "uploaded" | "unconfirmed" | "simulated" | "failed" | "blocked" | "cancelled";

export type Publication = {
  id: string;
  render_id: string;
  lesson_title: string | null;
  destination: string;
  account: { id: string; name: string; platform: string };
  title: string;
  visibility: string;
  scheduled_at: string;
  next_attempt_at: string | null;
  status: PublicationStatus;
  attempts: number;
  external_id: string | null;
  external_url: string | null;
  warnings: string[];
  approval_mode: "owner" | "auto";
  is_sample: boolean;
  error: string | null;
  created_by: string;
  published_at: string | null;
  description?: string;
  tags?: string[];
  video_sha256?: string;
  log?: { number: number; started_at: string; finished_at: string | null; outcome: string; http_status: number | null; message: string | null }[];
};

export type PublishingOverview = {
  status: {
    paused: boolean;
    pause_reason: string | null;
    trial_mode: boolean;
    auto_publish_enabled: boolean;
    allow_public: boolean;
    approved_count: number;
    required_approved: number;
    daily_limit: number;
    sent_today: number;
  };
  publications: Publication[];
};

export type PublishOptions = {
  render_id: string;
  approved: boolean;
  destinations: {
    destination: string;
    fits: boolean;
    accounts: { id: string; name: string }[];
    visibilities: string[];
    default_visibility: string | null;
    caption: { title: string; description: string; tags: string[] };
  }[];
};

export type AffiliateLinkRow = { id: string; slug: string; name: string; partner: string; destination_url: string; disclosure_yo: string; disclosure_en: string; commission_note: string | null; active: boolean; clicks: number; public_path: string };
export type ProductRow = { id: string; name_yo: string; name_en: string; description: string; kind: string; price_minor: number; currency: string; status: "draft" | "active" | "archived"; delivery_note: string | null };
export type OrderRow = { id: string; reference: string; product_id: string; amount_minor: number; currency: string; provider: string; status: "pending" | "paid" | "failed" | "refunded"; checkout_url: string | null; is_sample: boolean; paid_at: string | null; created_at: string };
export type SponsorshipRow = { id: string; sponsor_name: string; contact: string | null; deliverables: string; value_minor: number; currency: string; status: "proposed" | "agreed" | "delivered" | "paid" | "cancelled"; next: string[]; contract_reference: string | null; render_ids: string[]; starts_on: string | null; ends_on: string | null; notes: string | null };
export type RevenueRow = { id: string; source: string; reference: string; amount_minor: number; currency: string; occurred_on: string; description: string; is_estimate: boolean; created_by: string };
export type MonetisationOverview = {
  links: AffiliateLinkRow[];
  products: ProductRow[];
  orders: OrderRow[];
  sponsorships: SponsorshipRow[];
  revenue: RevenueRow[];
  payments: { provider: string; sample_mode: boolean; configured: boolean; test_key: boolean; webhook_url: string };
};

export type VideoSummary = { days: number; views: number; watch_hours: string | null; avg_view_seconds: string | null; engagement_rate_percent: string | null; subscribers_gained: number; estimated_revenue_minor: number | null; revenue_complete: boolean; rpm: string | null };
export type AnalyticsReport = {
  period: { start: string; end: string; days: number };
  revenue: Record<string, { total: number; by_source: Record<string, number>; estimated: number }>;
  cost_usd: string | null;
  net_usd: string | null;
  approved_videos: number;
  cost_per_approved_video_usd: string | null;
  totals: VideoSummary;
  videos: (VideoSummary & { publication_id: string; title: string; destination: string; url: string | null })[];
  monthly: { month: string; revenue: Record<string, number>; cost_usd: string | null }[];
  affiliates: { id: string; slug: string; name: string; clicks: number; conversions: number; conversion_rate_percent: string | null; revenue: Record<string, number>; epc: Record<string, string | null> }[];
  orders: { status: string; count: number; amount_minor: number; currency: string }[];
  sponsorships: { status: string; count: number; value_minor: number; currency: string }[];
  youtube_revenue_reported: boolean;
  estimates_included: boolean;
};

export type SystemHealth = {
  status: "ok" | "warn" | "error";
  checks: { code: string; level: "ok" | "warn" | "error"; message: string; details: Record<string, unknown> }[];
  alerts_configured: boolean;
};
