'use client';
import { readApiResponse } from '@/lib/api-response';
import type * as Rows from '@/lib/types';
import { useWorkspace } from '@/hooks/use-workspace';
import WorkspacePagination from './workspace-pagination';
import RetentionPanel from './retention-panel';
import DeliveryHealth from './delivery-health';
import ContentEditor from './admin/content-editor';
import PaymentSettingsPanel from './admin/payment-settings-panel';
import EnquiryDetail from './admin/enquiry-detail';
import EnquiryWorkspace from './admin/enquiry-workspace';
import MediaReview from './admin/media-review';
import MediaWorkspace from './admin/media-workspace';

import AppImage from './app-image';
import AppLink from './app-link';

import { useStaffApi } from '@/hooks/use-staff-api';
import { useAdminSession } from '@/hooks/use-admin-session';
import { useClock } from '@/hooks/use-clock';
import { useRequestGuard } from '@/hooks/use-request-guard';
import { hasSecondFactor } from '@/lib/assurance';
import type { AuthSession } from '@/lib/auth-client';
import { kinds, seed, type Content, type Kind } from '@/lib/content';
import { extraKeys } from '@/lib/editorial';
import {
  ArrowUpRight,
  FileText,
  Image as ImageIcon,
  Inbox,
  Leaf,
  LogOut,
  Menu,
  Plus,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import AdminDevice, { disableDevice } from './admin-device';
import AnalyticsPanel from './analytics-panel';
import MfaGate from './mfa-gate';
import NotificationInbox from './notification-inbox';
import NotificationBell from './notification-bell';
import WorkspacePanels from './workspace-panels';
type Profile = Rows.Profile;
type Media = Rows.MediaRow;
type Enquiry = Rows.EnquiryRow;
const labels: Record<Kind, string> = {
  page: 'Pages',
  programme: 'Programmes',
  story: 'Stories',
  event: 'Events',
  report: 'Reports & policies',
  campaign: 'Giving campaigns',
  product: 'Merchandise',
  album: 'Photo albums',
};
export default function WebsiteAdmin() {
  const [config, setConfig] = useState<{ configured: boolean; url: string; key: string } | null>(
      null,
    ),
    [session, setSession] = useState<AuthSession | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [items, setItems] = useState<Content[]>([]),
    [media, setMedia] = useState<Media[]>([]),
    [enquiries, setEnquiries] = useState<Enquiry[]>([]),
    [section, setSection] = useState<string>('overview'),
    [kids, setKids] = useState(false),
    [kidsTab, setKidsTab] = useState('album'),
    [statusFilter, setStatusFilter] = useState('All'),
    [mail, setMail] = useState<Rows.EmailJob[]>([]),
    [engagement, setEngagement] = useState<Rows.EngagementRow[]>([]),
    [staff, setStaff] = useState<Profile[]>([]),
    [integrations, setIntegrations] = useState<Record<string, boolean>>({}),
    [selected, setSelected] = useState<Content | null>(null),
    [creating, setCreating] = useState(false),
    [chosenMedia, setChosenMedia] = useState<Media | null>(null),
    [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null),
    [revisions, setRevisions] = useState<Rows.RevisionRow[]>([]),
    [preview, setPreview] = useState(false),
    [search, setSearch] = useState(''),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [editorReady, setEditorReady] = useState(true),
    [refresh, setRefresh] = useState(0),
    [paging, setPaging] = useState({ key: '', page: 0 }),
    [summary, setSummary] = useState<Record<string, number> | null>(null),
    [note, setNote] = useState(''),
    [schedule, setSchedule] = useState(''),
    [mobile, setMobile] = useState(false),
    [enquiryStatus, setEnquiryStatus] = useState('Open'),
    [enquiryKind, setEnquiryKind] = useState('All'),
    [enquiryAssignee, setEnquiryAssignee] = useState('All'),
    [editingMedia, setEditingMedia] = useState<Partial<Rows.MediaRow>>({});
  const now = useClock();
  const editorGuard = useRequestGuard();
  const guard = useRequestGuard(),
    demo = config?.configured === false,
    role = (r: string[]) => !!profile?.active && profile.roles.some((v) => r.includes(v));
  const api = useStaffApi(session, setMessage);
  const filterKey = JSON.stringify([
    section,
    search,
    statusFilter,
    kids,
    enquiryStatus,
    enquiryKind,
    enquiryAssignee,
  ]);
  const page = paging.key === filterKey ? paging.page : 0;
  const setPage = (page: number) => setPaging({ key: filterKey, page });
  const resource = kinds.includes(section as Kind)
    ? 'content'
    : section === 'media'
      ? 'media'
      : section === 'enquiries'
        ? 'enquiries'
        : null;
  const workspace = useWorkspace(
    api,
    !demo && profile && resource
      ? new URLSearchParams({
          resource,
          page: String(page),
          query: search,
          status: resource === 'enquiries' ? enquiryStatus : statusFilter,
          kind: resource === 'content' ? section : enquiryKind,
          scope: kids ? 'aminia-kids' : '',
          assignee: enquiryAssignee,
        }).toString()
      : null,
    refresh,
  );

  useEffect(() => {
    fetch('/api/website-config')
      .then((r) => readApiResponse<Rows.WebsiteConfig>(r))
      .then((c) => {
        setConfig(c);
        if (!c.configured) {
          setItems(seed);
          setProfile({
            id: 'preview',
            name: 'Content preview',
            roles: ['administrator'],
            active: true,
          });
        } else {
          try {
            setSession(JSON.parse(sessionStorage.getItem('ahf-website-session') || 'null'));
          } catch {}
        }
      })
      .catch((e) => setError(e.message));
  }, []);
  const applyEditorialData = useCallback((v: Rows.EditorialResponse) => {
    setProfile(v.profile);
    setItems(v.items);
    setMedia(v.media);
    setEnquiries(v.enquiries);
    setSelectedEnquiry((s) => (s ? v.enquiries.find((e: Enquiry) => e.id === s.id) || null : null));
    setMail(v.mail || []);
    setEngagement(v.engagement || []);
    setStaff(v.staff || []);
    setIntegrations(v.integrations || {});
    setSelected((s) => (s ? v.items.find((i: Content) => i.id === s.id) || null : null));
  }, []);
  useEffect(() => {
    if (!profile?.id || demo || !['overview', 'calendar'].includes(section)) return;
    let active = true;
    void api<Record<string, number>>('workspace?resource=summary')
      .then((v) => {
        if (active) setSummary(v);
      })
      .catch(() => {});
    void api<Rows.EditorialResponse>('editorial?view=' + section)
      .then((v) => {
        if (active) applyEditorialData(v);
      })
      .catch((e) => {
        if (active && (e as Error).name !== 'AbortError') setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [api, profile?.id, demo, section, refresh, applyEditorialData]);
  const load = useCallback(async () => {
    if (!session || !hasSecondFactor(session.access_token)) return;
    const e = guard.capture();
    const editorEpoch = editorGuard.capture();
    const mode = selectedEnquiry ? 'enquiry' : selected || creating ? 'editor' : 'overview';
    const id = selectedEnquiry?.id || selected?.id;
    const current = () => guard.isCurrent(e) && editorGuard.isCurrent(editorEpoch);
    try {
      const v = await api<Rows.EditorialResponse>(
        'editorial?view=' + mode + (id ? '&id=' + id : ''),
      );
      if (!current()) return;
      applyEditorialData(v);
      setRefresh((v) => v + 1);
    } catch (error) {
      if (current()) throw error;
    }
  }, [api, session, guard, editorGuard, applyEditorialData, selected, selectedEnquiry, creating]);
  useEffect(() => {
    if (!session || !config?.configured || !hasSecondFactor(session.access_token)) return;
    const generation = guard.capture();
    const current = () => {
      try {
        return (
          JSON.parse(sessionStorage.getItem('ahf-website-session') || 'null')?.access_token ===
          session.access_token
        );
      } catch {
        return false;
      }
    };
    void api<Rows.EditorialResponse>('editorial?view=bootstrap')
      .then((v) => {
        if (guard.isCurrent(generation) && current()) {
          setProfile(v.profile);
          setStaff(v.staff);
          setIntegrations(v.integrations);
          if (!v.profile.roles.some((r) => ['administrator', 'editor', 'publisher'].includes(r))) {
            setSelected(null);
            setCreating(false);
            setChosenMedia(null);
            setDirty(false);
          }
          if (!v.profile.roles.some((r) => ['administrator', 'enquiry_coordinator'].includes(r)))
            setSelectedEnquiry(null);
        }
      })
      .catch((e: Error) => {
        if (guard.isCurrent(generation) && current() && e.name !== 'AbortError') {
          setError(e.message);
          setProfile(null);
        }
      });
  }, [api, session, config, guard, applyEditorialData]);
  useAdminSession({ session, config, guard, setSession, setProfile, setError });
  const modalOpen = !!(selected || creating || chosenMedia || selectedEnquiry);
  useEffect(() => {
    if (!modalOpen) return;
    const prior = document.activeElement as HTMLElement | null;
    const root = document.querySelector<HTMLElement>('[role="dialog"]');
    const candidates = () =>
      Array.from(
        root?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]',
        ) || [],
      ).filter((e) => e.offsetParent !== null);
    candidates()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (busy || document.querySelector('[data-uploading="true"]')) return;
        if (dirty && !window.confirm('Discard unsaved content changes?')) return;
        editorGuard.invalidate();
        setDirty(false);
        setSelected(null);
        setCreating(false);
        setChosenMedia(null);
        setSelectedEnquiry(null);
      }
      if (e.key === 'Tab') {
        const all = candidates(),
          first = all[0],
          last = all[all.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      prior?.focus();
    };
  }, [modalOpen, dirty, busy, editorGuard]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const closeEditor = () => {
    if (busy || document.querySelector('[data-uploading="true"]')) {
      setError('Please wait for the current upload or change to finish.');
      return;
    }
    if (dirty && !window.confirm('Discard unsaved content changes?')) return;
    editorGuard.invalidate();
    setDirty(false);
    setSelected(null);
    setCreating(false);
  };
  const operation = useRef(0);
  const run = async (fn: () => Promise<void>, editorTicket?: number) => {
    const operationId = ++operation.current;
    const generation = guard.capture();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
    } catch (e) {
      if (
        guard.isCurrent(generation) &&
        (editorTicket === undefined || editorGuard.isCurrent(editorTicket)) &&
        (e as Error).name !== 'AbortError'
      )
        setError((e as Error).message);
    } finally {
      if (guard.isCurrent(generation) && operationId === operation.current) setBusy(false);
    }
  };
  const login = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    logout();
    await run(async () => {
      if (!config) return;
      const r = await fetch(config.url + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { apikey: config.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: f.get('email'), password: f.get('password') }),
      });
      const v = await readApiResponse<Rows.TokenResponse>(r);
      if (!r.ok) throw Error('Sign-in failed. Check your email and password.');
      const s = {
        access_token: v.access_token,
        refresh_token: v.refresh_token,
        expires_at: Date.now() / 1000 + v.expires_in,
      };
      sessionStorage.setItem('ahf-website-session', JSON.stringify(s));
      setSession(s);
    });
  };
  const clearPrivateState = () => {
    guard.invalidate();
    editorGuard.invalidate();
    setSummary(null);
    setBusy(false);
    setDirty(false);
    setCreating(false);
    setRevisions([]);
    setPreview(false);
    setNote('');
    setSchedule('');
    setEditingMedia({});
    setSession(null);
    setProfile(null);
    setItems([]);
    setMedia([]);
    setEnquiries([]);
    setMail([]);
    setStaff([]);
    setEngagement([]);
    setIntegrations({});
    setSelected(null);
    setSelectedEnquiry(null);
    setChosenMedia(null);
    sessionStorage.removeItem('ahf-website-session');
  };
  const logout = () => {
    const prior = session,
      authConfig = config;
    clearPrivateState();
    const cleanupGeneration = guard.capture();
    const revoke: Rows.StaffApi = async <T,>(path: string, init: RequestInit = {}) => {
      if (!prior || path !== 'notifications') throw Error('Device cleanup unavailable.');
      const response = await fetch('/api/notifications', {
        ...init,
        headers: {
          Authorization: 'Bearer ' + prior.access_token,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
        keepalive: true,
      });
      return readApiResponse<T>(response);
    };
    void disableDevice(
      revoke,
      () => guard.isCurrent(cleanupGeneration) && !sessionStorage.getItem('ahf-website-session'),
    )
      .catch(() => {})
      .finally(() => {
        if (prior && authConfig)
          void fetch(authConfig.url + '/auth/v1/logout?scope=local', {
            method: 'POST',
            headers: { apikey: authConfig.key, Authorization: 'Bearer ' + prior.access_token },
            signal: AbortSignal.timeout(5000),
            keepalive: true,
          }).catch(() => {});
      });
  };
  const choose = (s: string, nextKids?: boolean) => {
    if (dirty && !window.confirm('Discard unsaved content changes?')) return false;
    if (nextKids !== undefined) setKids(nextKids);
    editorGuard.invalidate();
    setDirty(false);
    setSection(s);
    setStatusFilter('All');
    setSelected(null);
    setCreating(false);
    setSelectedEnquiry(null);
    setChosenMedia(null);
    setSearch('');
    setMobile(false);
    setNote('');
    setRevisions([]);
    return true;
  };
  const prepareEditor = (id?: string) => {
    editorGuard.invalidate();
    const ticket = editorGuard.capture();
    setEditorReady(demo);
    if (!demo)
      void api<Rows.EditorialResponse>('editorial?view=editor' + (id ? '&id=' + id : ''))
        .then((v) => {
          if (editorGuard.isCurrent(ticket)) {
            applyEditorialData(v);
            setEditorReady(true);
          }
        })
        .catch((e) => {
          if (editorGuard.isCurrent(ticket) && (e as Error).name !== 'AbortError')
            setError((e as Error).message);
        });
  };
  const beginCreate = () => {
    setCreating(true);
    prepareEditor();
  };
  const openEnquiry = (row: Enquiry) => {
    setSelectedEnquiry(row);
    editorGuard.invalidate();
    const editorEpoch = editorGuard.capture();
    const e = guard.capture();
    void api<Rows.EditorialResponse>('editorial?view=enquiry&id=' + row.id)
      .then((v) => {
        if (guard.isCurrent(e) && editorGuard.isCurrent(editorEpoch)) applyEditorialData(v);
      })
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') setError((e as Error).message);
      });
  };
  const open = (item: Content) => {
    prepareEditor(item.id);
    setDirty(false);
    setSection(item.kind);
    setSelected(item);
    setCreating(false);
    setPreview(false);
    setNote('');
    const generation = guard.capture(),
      revisionEpoch = editorGuard.capture();
    setRevisions([]);
    if (!demo)
      api<Rows.RevisionRow[]>('revisions?id=' + item.id)
        .then((rows) => {
          if (guard.isCurrent(generation) && editorGuard.isCurrent(revisionEpoch))
            setRevisions(rows);
        })
        .catch((e) => {
          if (
            guard.isCurrent(generation) &&
            editorGuard.isCurrent(revisionEpoch) &&
            e.name !== 'AbortError'
          )
            setError(e.message);
        });
  };
  const finishContentMutation = (row: Content, ticket: number, message: string) => {
    if (!editorGuard.isCurrent(ticket)) return;
    editorGuard.invalidate();
    const updated: Content = {
      ...row,
      // Publishing uses the same database transaction timestamp for updated_at and publish_at.
      live_since:
        row.status === 'Archived'
          ? undefined
          : row.status === 'Published'
            ? row.updated_at
            : selected?.id === row.id
              ? selected.live_since
              : undefined,
    };
    setSelected(updated);
    setCreating(false);
    setDirty(false);
    setEditorReady(true);
    setPreview(false);
    setItems((items) => [updated, ...items.filter((item) => item.id !== row.id)]);
    setRevisions([]);
    setNote('');
    setRefresh((v) => v + 1);
    setMessage(message);
  };
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (e.currentTarget.querySelector('[data-uploading="true"]')) {
      setError('Please wait for the cover upload to finish before saving.');
      return;
    }
    const f = new FormData(e.currentTarget);
    const ticket = editorGuard.capture();
    await run(async () => {
      const details: Record<string, string> = {};
      for (const key of [
        'vision',
        'mission',
        'location',
        'link',
        'caption',
        'price',
        'currency',
        ...extraKeys,
      ])
        if (f.get(key)) details[key] = String(f.get(key));
      if (details.end_date) details.end_date += '+03:00';
      if (f.get('date')) details.date = String(f.get('date')) + '+03:00';
      if (selected?.details.image) details.image = selected.details.image;
      const payload = {
        kind: selected?.kind || section,
        title: f.get('title'),
        slug: f.get('slug'),
        summary: f.get('summary') || '',
        body: f.get('body') || '',
        cover_id: f.get('cover_id') || null,
        details,
      };
      const row = await api<Rows.ContentItem>('editorial', {
        method: 'POST',
        body: JSON.stringify({
          action: 'save',
          id: selected?.id || undefined,
          version: selected?.version,
          payload,
        }),
      });
      finishContentMutation(row, ticket, 'Draft saved. The live publication is unchanged.');
    }, ticket);
  };
  const transition = (target: string) => {
    const ticket = editorGuard.capture();
    void run(async () => {
      if (!selected) return;
      const row = await api<Rows.ContentItem>('editorial', {
        method: 'POST',
        body: JSON.stringify({
          action: target === 'WithdrawPublic' ? 'withdraw' : 'transition',
          id: selected.id,
          version: selected.version,
          target,
          note,
          scheduled_at: target === 'Scheduled' && schedule ? schedule + '+03:00' : null,
        }),
      });
      finishContentMutation(
        row,
        ticket,
        target === 'WithdrawPublic'
          ? 'Public version withdrawn. Saved content remains available for a new review.'
          : target === 'Draft'
            ? 'A new draft is ready. The current public version stays live.'
            : 'Content marked ' + target.toLowerCase() + '.',
      );
    }, ticket);
  };
  const openNotification = (id: string) => {
    const ticket = editorGuard.capture();
    void run(async () => {
      const result = await api<{
        target: 'content' | 'media' | 'enquiry' | null;
        row?: Content | Media | Enquiry;
      }>('notification-target?id=' + encodeURIComponent(id));
      if (!editorGuard.isCurrent(ticket)) return;
      if (!result.target || !result.row) {
        setMessage('This notification has no linked item.');
        return;
      }
      if (result.target === 'content') open(result.row as Content);
      else if (result.target === 'media') {
        const row = result.row as Media;
        editorGuard.invalidate();
        setEditingMedia(row);
        setChosenMedia(row);
      } else openEnquiry(result.row as Enquiry);
    }, ticket);
  };
  if (!config)
    return (
      <div className="auth-screen">
        <p>{error || 'Opening website admin…'}</p>
      </div>
    );
  if (!demo && session && !hasSecondFactor(session.access_token))
    return (
      <MfaGate
        config={config}
        session={session}
        onVerified={(s) => {
          sessionStorage.setItem('ahf-website-session', JSON.stringify(s));
          setSession(s);
        }}
        onCancel={logout}
      />
    );
  if (!demo && !profile)
    return (
      <main className="login-page">
        <section className="login-welcome" aria-label="Welcome to Aminia Hope Foundation">
          <AppLink href="/" className="login-brand" aria-label="Aminia Hope Foundation home">
            <AppImage
              src="/images/brand-991c0b4ae252.webp"
              alt="Aminia Hope Foundation"
              width={240}
              height={240}
              loading="eager"
            />
          </AppLink>
          <div className="login-welcome-content">
            <span className="login-eyebrow">AMINIA HOPE FOUNDATION</span>
            <h1>
              Every story can
              <br />
              make hope grow.
            </h1>
            <p>
              Welcome to your website workspace. Together, we share the stories, programmes and
              moments that bring our mission to life.
            </p>
            <div className="login-quote">
              “Let all that you do be done in love.” <span>1 Corinthians 16:14</span>
            </div>
          </div>
          <p className="login-welcome-footer">BELIEVE. SERVE. BRING HOPE.</p>
        </section>
        <section className="login-form-side" aria-label="Staff sign in">
          <div className="login-form-wrap">
            <div className="login-mobile-brand">
              <AppImage
                src="/images/brand-991c0b4ae252.webp"
                alt="Aminia Hope Foundation"
                width={112}
                height={112}
                loading="eager"
              />
            </div>
            <span className="login-form-eyebrow">STAFF WORKSPACE</span>
            <h2>Welcome back</h2>
            <p className="login-intro">Sign in to manage your foundation’s website.</p>
            <div className="login-card">
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <form onSubmit={login}>
                <label>
                  Email address
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="username"
                    placeholder="you@example.com"
                  />
                </label>
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                  />
                </label>
                <button type="submit" className="login-submit" disabled={busy}>
                  {busy ? 'Signing in…' : 'Sign in to workspace'} <span aria-hidden="true">→</span>
                </button>
              </form>
              <p className="login-help">
                Having trouble signing in? Contact your website administrator.
              </p>
            </div>
            <AppLink href="/" className="login-return">
              ← Back to the website
            </AppLink>
            <p className="login-security">
              <ShieldCheck size={16} aria-hidden="true" /> For authorized foundation staff
            </p>
          </div>
          <p className="login-side-footer">
            Aminia Hope Foundation <span>·</span> Built with purpose
          </p>
        </section>
      </main>
    );
  const editable = demo || role(['administrator', 'editor']),
    publishable = role(['administrator', 'publisher']);
  const workspaceItems = items.filter(
    (i) => !kids || i.details.scope === 'aminia-kids' || i.slug === 'aminia-kids',
  );
  const drafts = workspaceItems.filter((i) => i.status === 'Draft' || i.status === 'Returned');
  const filtered =
    !demo && resource === 'content'
      ? (workspace.rows as Content[])
      : items.filter(
          (i) =>
            i.kind === section &&
            (!kids || i.details.scope === 'aminia-kids' || i.slug === 'aminia-kids') &&
            (statusFilter === 'All' || i.status === statusFilter) &&
            [i.title, i.slug, i.summary].join(' ').toLowerCase().includes(search.toLowerCase()),
        );
  return (
    <div className="cms">
      <header className="cms-header" inert={modalOpen}>
        <AppLink className="brand" href="/">
          <AppImage src="/images/brand-991c0b4ae252.webp" alt="" />
        </AppLink>
        <span>Public content workspace</span>
        <div>
          <AppLink href="/" target="_blank" rel="noreferrer">
            View website <ArrowUpRight size={16} />
          </AppLink>
          <NotificationBell
            key={profile?.id || 'preview'}
            api={api}
            enabled={!demo && !!profile}
            onOpenTarget={openNotification}
            onOpen={() => {
              choose('notifications', false);
            }}
          />
          <button
            onClick={() => setMobile(!mobile)}
            className="mobile-admin-toggle"
            aria-label="Toggle admin navigation"
          >
            <Menu size={20} />
          </button>
          <span className="cms-avatar">{profile?.name.slice(0, 1)}</span>
        </div>
      </header>
      <aside className={'cms-sidebar ' + (mobile ? 'open' : '')} inert={modalOpen}>
        <button
          className={section === 'overview' ? 'active' : ''}
          onClick={() => {
            choose('overview', false);
          }}
        >
          <Leaf size={17} />
          Overview
        </button>
        {(demo || role(['administrator'])) && (
          <button
            className={section === 'analytics' ? 'active' : ''}
            onClick={() => {
              choose('analytics', false);
            }}
          >
            <ShieldCheck size={17} />
            Analytics
          </button>
        )}
        <button
          className={section === 'notifications' ? 'active' : ''}
          onClick={() => {
            choose('notifications', false);
          }}
        >
          <Inbox size={17} />
          Notifications
        </button>
        {(demo || role(['administrator', 'editor', 'publisher'])) && (
          <details className="cms-nav-group" open>
            <summary>Giving</summary>
            <button
              className={section === 'donation' ? 'active' : ''}
              onClick={() => choose('donation', false)}
            >
              Donation workspace
            </button>
            {role(['administrator']) && (
              <button
                className={section === 'payment-settings' ? 'active' : ''}
                onClick={() => choose('payment-settings', false)}
              >
                Payment settings
              </button>
            )}
          </details>
        )}
        <details className="cms-nav-group" open>
          <summary>Content</summary>
          {kinds
            .filter(
              (kind) =>
                kind !== 'campaign' && (demo || role(['administrator', 'editor', 'publisher'])),
            )
            .map((k) => (
              <button
                key={k}
                className={section === k ? 'active' : ''}
                onClick={() => {
                  choose(k, false);
                }}
              >
                <FileText size={17} />
                {labels[k]}
              </button>
            ))}
        </details>
        {(demo || role(['administrator', 'editor', 'publisher'])) && (
          <button
            onClick={() => choose('media', false)}
            className={section === 'media' ? 'active' : ''}
          >
            <ImageIcon size={17} />
            Media & consent
          </button>
        )}
        {(demo || role(['administrator', 'enquiry_coordinator'])) && (
          <button
            onClick={() => choose('enquiries', false)}
            className={section === 'enquiries' ? 'active' : ''}
          >
            <Inbox size={17} />
            Enquiries
          </button>
        )}
        <p>WORKSPACE</p>
        {(demo || role(['administrator', 'editor', 'publisher'])) && (
          <>
            <button
              className={kids ? 'active' : ''}
              onClick={() => {
                choose(kidsTab, true);
              }}
            >
              <Leaf size={17} />
              Aminia Kids studio
            </button>
            <button
              className={section === 'calendar' ? 'active' : ''}
              onClick={() => {
                choose('calendar', false);
              }}
            >
              <FileText size={17} />
              Editorial calendar
            </button>
          </>
        )}
        <button
          onClick={() => choose('settings', false)}
          className={section === 'settings' ? 'active' : ''}
        >
          <Settings size={17} />
          Settings
        </button>
        <div className="cms-sidebar-bottom">
          <Leaf size={24} />
          <strong>Tell the story with care.</strong>
          <small>Public content. Deliberate publishing.</small>
          {!demo && (
            <button onClick={logout}>
              <LogOut size={15} />
              Sign out
            </button>
          )}
        </div>
      </aside>
      <main className="cms-main" inert={modalOpen}>
        {demo && (
          <div className="notice cms-preview">
            <strong>Read-only content preview</strong>
            <p>
              The website backend is not connected. Set up the separate content database and staff
              sign-in to enable editing, media uploads and publishing. No operational records are
              loaded here.
            </p>
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="notice" role="status">
            {message}
          </div>
        )}
        <div className="cms-heading">
          <div>
            <p className="eyebrow">WEBSITE / {labels[section as Kind] || section}</p>
            <h1>
              {labels[section as Kind] ||
                (
                  {
                    media: 'Media & consent',
                    enquiries: 'Enquiries',
                    settings: 'Website settings',
                    overview: 'Your publishing desk',
                    calendar: 'Editorial calendar',
                    analytics: 'Visitor analytics',
                    notifications: 'Notifications',
                    donation: 'Donation workspace',
                    'payment-settings': 'Payment settings',
                  } as Record<string, string>
                )[section]}
            </h1>
            <p>
              {kids
                ? 'AMINIA KIDS STUDIO · Media, learning and performances.'
                : 'Prepare thoughtfully. Review together. Publish with confidence.'}
            </p>
          </div>
          {kinds.includes(section as Kind) && editable && (
            <button
              className="btn green"
              disabled={demo || busy}
              onClick={() => {
                setSelected(null);
                beginCreate();
                setPreview(false);
              }}
            >
              <Plus size={17} />
              Add {section}
            </button>
          )}
        </div>
        {['overview', 'settings', 'notifications'].includes(section) && (
          <AdminDevice api={api} enabled={!demo} />
        )}
        {section === 'analytics' && (demo || role(['administrator'])) && (
          <AnalyticsPanel api={api} demo={demo} />
        )}
        {section === 'notifications' && (
          <NotificationInbox api={api} demo={demo} onOpen={openNotification} />
        )}
        {section === 'payment-settings' && role(['administrator']) && (
          <PaymentSettingsPanel api={api} profile={profile} dirty={dirty} setDirty={setDirty} />
        )}
        {['overview', 'calendar', 'settings', 'donation'].includes(section) && (
          <WorkspacePanels
            roles={profile?.roles || []}
            summary={summary}
            section={section}
            items={items}
            media={media}
            enquiries={enquiries}
            mail={mail}
            integrations={integrations}
            engagement={engagement}
            onChoose={choose}
            onOpen={open}
            onSettings={() => {
              const ticket = editorGuard.capture();
              void run(async () => {
                const rows = await api<Content[]>('editorial?view=website-settings');
                if (!editorGuard.isCurrent(ticket)) return;
                setKids(false);
                setSection('page');
                if (rows[0]) open(rows[0]);
                else {
                  beginCreate();
                  setSelected({
                    id: '',
                    kind: 'page',
                    slug: 'site-settings',
                    title: 'Foundation website settings',
                    summary: 'Confirmed foundation information',
                    body: '',
                    details: {},
                    status: 'Draft',
                  });
                }
              }, ticket);
            }}
          />
        )}
        {kids && (
          <div className="studio-tabs">
            <p className="eyebrow">AMINIA KIDS WORKSPACE</p>
            {[
              ['album', 'Photo collections'],
              ['programme', 'Education & activities'],
              ['event', 'Events & performances'],
              ['story', 'Stories'],
              ['campaign', 'Support activities'],
              ['media', 'Photos, videos & consent'],
            ].map(([key, label]) => (
              <button
                key={key}
                className={section === key ? 'active' : ''}
                onClick={() => {
                  if (choose(key, true)) setKidsTab(key);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {kinds.includes(section as Kind) && (
          <>
            <div className="cms-metrics">
              <div>
                <span>Content items</span>
                <strong>{workspaceItems.length}</strong>
              </div>
              <div>
                <span>Drafts & returned</span>
                <strong>{drafts.length}</strong>
              </div>
              <div>
                <span>Awaiting review</span>
                <strong>{workspaceItems.filter((i) => i.status === 'Review').length}</strong>
              </div>
              <div>
                <span>Published / scheduled</span>
                <strong>
                  {
                    workspaceItems.filter((i) =>
                      ['Published', 'Scheduled'].includes(i.status || ''),
                    ).length
                  }
                </strong>
              </div>
            </div>
            <section className="cms-card">
              <div className="cms-toolbar">
                <input
                  aria-label="Search content"
                  placeholder="Search titles or URLs…"
                  maxLength={100}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label="Filter content status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {[
                    'All',
                    'Draft',
                    'Review',
                    'Approved',
                    'Published',
                    'Scheduled',
                    'Returned',
                    'Archived',
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
                <span>{filtered.length} items</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>URL</th>
                      <th>Status</th>
                      <th>Version</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <button className="cms-row-title" onClick={() => open(i)}>
                            {i.title}
                          </button>
                        </td>
                        <td>{i.slug}</td>
                        <td>
                          <span className="cms-badge">
                            {i.effective_status || i.status || 'Provided content'}
                          </span>
                        </td>
                        <td>{i.version || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!filtered.length && <div className="cms-empty">No content in this section yet.</div>}
            </section>
          </>
        )}
        {resource && !demo && (
          <>
            <WorkspacePagination page={page} total={workspace.total} onPage={setPage} />
            {workspace.error && (
              <p role="alert" className="error">
                {workspace.error}
              </p>
            )}
          </>
        )}
        <MediaWorkspace
          section={section}
          editable={editable}
          demo={demo}
          busy={busy}
          run={run}
          setMessage={setMessage}
          api={api}
          load={load}
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          media={!demo && resource === 'media' ? (workspace.rows as Media[]) : media}
          setChosenMedia={setChosenMedia}
          setEditingMedia={setEditingMedia}
        />
        <EnquiryWorkspace
          section={section}
          enquiryStatus={enquiryStatus}
          setEnquiryStatus={setEnquiryStatus}
          enquiryKind={enquiryKind}
          setEnquiryKind={setEnquiryKind}
          enquiryAssignee={enquiryAssignee}
          setEnquiryAssignee={setEnquiryAssignee}
          staff={staff}
          search={search}
          setSearch={setSearch}
          demo={demo}
          enquiries={!demo && resource === 'enquiries' ? (workspace.rows as Enquiry[]) : enquiries}
          onOpen={openEnquiry}
          setNote={setNote}
          now={now}
        />
        {section === 'settings' && !demo && role(['administrator']) && (
          <>
            <DeliveryHealth api={api} />
            <RetentionPanel api={api} />
          </>
        )}
        {false && section === 'settings' && (
          <div className="cms-settings">
            <section className="cms-card padded">
              <ShieldCheck size={28} />
              <h2>Access and publishing</h2>
              <p>{profile?.name}</p>
              <p>{profile?.roles.join(' · ')}</p>
              <ul>
                <li>Editors prepare drafts and submit for review.</li>
                <li>A different publisher approves the submitted version.</li>
                <li>Publishing and scheduling use approved snapshots.</li>
                <li>Revising a live page keeps the current public version online.</li>
                <li>Enquiry access is separate from editorial access.</li>
              </ul>
            </section>
            <section className="cms-card padded">
              <h2>Ready for your domain</h2>
              <p>
                Deploy later on Cloudflare using the source README. Keep the website content project
                separate from NGO management.
              </p>
              <p>
                Before launch, confirm official contact details, donation arrangements,
                privacy/retention information, safeguarding channels and image permissions.
              </p>
              <p className="fine">
                Staff accounts and roles are provisioned through the website’s Supabase project. The
                public website has no signup or role-promotion endpoint.
              </p>
            </section>
          </div>
        )}
      </main>
      <ContentEditor
        key={selected?.id || 'new'}
        loadChoices={async (query, page, ids) => {
          const ticket = editorGuard.capture();
          const choices = await api<{ items: Content[]; media: Media[]; has_more: boolean }>(
            'editor-choices?' +
              new URLSearchParams({
                query,
                page: String(page),
                ...(selected?.id ? { id: selected.id } : {}),
                selected: ids.join(','),
              }),
          );
          if (editorGuard.isCurrent(ticket)) {
            setItems(choices.items);
            setMedia(choices.media);
          }
          return choices.has_more;
        }}
        ready={editorReady}
        dirty={dirty}
        setDirty={setDirty}
        onClose={closeEditor}
        selected={selected}
        creating={creating}
        section={section}
        error={error}
        setPreview={setPreview}
        preview={preview}
        save={save}
        api={api}
        media={media}
        demo={demo}
        busy={busy}
        editable={editable}
        load={load}
        items={items}
        kids={kids}
        run={run}
        setMessage={setMessage}
        message={message}
        note={note}
        setNote={setNote}
        transition={transition}
        publishable={publishable}
        profile={profile}
        schedule={schedule}
        setSchedule={setSchedule}
        revisions={revisions}
        open={open}
      />
      <MediaReview
        chosenMedia={chosenMedia}
        setSelected={setSelected}
        setCreating={setCreating}
        setChosenMedia={setChosenMedia}
        setSelectedEnquiry={setSelectedEnquiry}
        error={error}
        run={run}
        api={api}
        editingMedia={editingMedia}
        setEditingMedia={setEditingMedia}
        editable={editable}
        busy={busy}
        load={load}
        publishable={publishable}
        profile={profile}
        setMessage={setMessage}
      />
      <EnquiryDetail
        selectedEnquiry={selectedEnquiry}
        setSelected={setSelected}
        setCreating={setCreating}
        setChosenMedia={setChosenMedia}
        setSelectedEnquiry={setSelectedEnquiry}
        error={error}
        api={api}
        load={load}
        mail={mail}
        busy={busy}
        run={run}
        setMessage={setMessage}
        staff={staff}
        note={note}
        setNote={setNote}
      />
    </div>
  );
}
