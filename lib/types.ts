import type { Content } from './content';
import type { PushSubscription } from 'web-push';
export type ContentItem = Content;
export interface Profile {
  id: string;
  name: string;
  roles: string[];
  active: boolean;
}
export interface MediaRow {
  id: string;
  filename: string;
  mime: string;
  alt_text: string;
  caption: string;
  shows_children: boolean;
  rights_confirmed: boolean;
  guardian_consent: boolean;
  consent_reference: string;
  status: string;
  created_by: string;
  version: number;
  object_path: string;
  external_url: string;
}
export interface EnquiryRow {
  id: string;
  kind: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: string;
  internal_note: string;
  version: number;
  created_at: string;
  assigned_to?: string;
  follow_up_at?: string;
  priority?: string;
}
export interface EmailJob {
  id: string;
  enquiry_id: string;
  kind: string;
  status: string;
  attempts: number;
  message: string;
  last_error: string;
}
export interface PushJob {
  lease_token: string;
  job_id: string;
  payload: PushSubscription;
  title: string;
  body: string;
  url: string;
}
export interface EngagementRow {
  day: string;
  action: string;
  count: number;
}
export interface ScheduleRow {
  content_id: string;
  publish_at: string;
}
export interface RevisionRow {
  id: string;
  version: number;
  created_at: string;
  snapshot: ContentItem;
}
export interface NotificationRow {
  id: string;
  enquiry_id?: string;
  kind: string;
  title: string;
  body: string;
  created_at: string;
  read_at?: string;
  url: string;
}
export interface NotificationResponse {
  rows: NotificationRow[];
  publicKey: string;
  configured: boolean;
}
export interface EnquiryAudit {
  id: string;
  created_at: string;
  status: string;
  note: string;
}
export interface VisitEvent {
  path: string;
  action: string;
  created_at: string;
}
export interface VisitSession {
  id: string;
  country: string;
  region: string;
  city: string;
  device: string;
  browser: string;
  referrer: string;
  first_seen: string;
  last_seen: string;
  last_path: string;
}
export interface AnalyticsData {
  quality_today?: Record<string, number>;
  sessions: number;
  visitors: number;
  live: number;
  pageviews: number;
  actions: number;
  countries: { country: string; sessions: number }[];
  pages: { path: string; views: number }[];
  days: { day: string; views: number }[];
  history: VisitSession[];
}
export interface EditorialResponse {
  has_more?: boolean;
  profile: Profile;
  items: ContentItem[];
  media: MediaRow[];
  enquiries: EnquiryRow[];
  mail: EmailJob[];
  staff: Profile[];
  engagement: EngagementRow[];
  integrations: Record<string, boolean>;
}
export interface WebsiteConfig {
  configured: boolean;
  url: string;
  key: string;
  formsReady: boolean;
  sitekey: string;
}
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}
export type StaffApi = <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
