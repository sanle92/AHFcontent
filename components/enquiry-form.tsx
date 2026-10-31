'use client';
import AppLink from './app-link';

import { readApiResponse } from '@/lib/api-response';
import { useEffect, useRef, useState, type FormEvent } from 'react';
declare global {
  interface Window {
    turnstile?: {
      render: (node: HTMLElement, options: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id: string) => void;
    };
  }
}
export default function EnquiryForm() {
  const [config, setConfig] = useState<{ formsReady: boolean; sitekey: string } | null>(null),
    [token, setToken] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [sent, setSent] = useState(false),
    [kind, setKind] = useState('contact'),
    [subject, setSubject] = useState('');
  const holder = useRef<HTMLDivElement>(null),
    widget = useRef<string | null>(null),
    submission = useRef<string | null>(null);
  useEffect(() => {
    const interest = new URLSearchParams(window.location.search).get('interest');
    const subject = new URLSearchParams(window.location.search).get('subject');
    fetch('/api/website-config')
      .then((r) => readApiResponse<{ formsReady: boolean; sitekey: string }>(r))
      .then((config) => {
        setConfig(config);
        if (subject) setSubject(subject.slice(0, 180));
        if (
          interest &&
          [
            'contact',
            'volunteer',
            'partner',
            'aminia-kids',
            'support',
            'merchandise',
            'event',
          ].includes(interest)
        )
          setKind(interest);
      })
      .catch(() => setMessage('The form is unavailable. Please try again later.'));
  }, []);
  useEffect(() => {
    if (!config?.formsReady) return;
    let cancelled = false;
    const draw = () => {
      if (!cancelled && holder.current && window.turnstile)
        widget.current = window.turnstile.render(holder.current, {
          sitekey: config.sitekey,
          action: 'ahf_enquiry',
          callback: (v: string) => setToken(v),
          'expired-callback': () => setToken(''),
          'error-callback': () =>
            setMessage('Verification could not load. Please refresh and retry.'),
        });
    };
    let script = document.querySelector<HTMLScriptElement>('script[data-ahf-turnstile]');
    if (window.turnstile) draw();
    else {
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.dataset.ahfTurnstile = 'true';
        document.head.appendChild(script);
      }
      script.addEventListener('load', draw);
    }
    return () => {
      cancelled = true;
      script?.removeEventListener('load', draw);
      if (widget.current) window.turnstile?.remove(widget.current);
    };
  }, [config]);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const f = new FormData(e.currentTarget);
    try {
      submission.current ||= crypto.randomUUID();
      const r = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': submission.current },
        body: JSON.stringify({
          kind,
          name: f.get('name'),
          email: f.get('email'),
          phone: f.get('phone'),
          message: (subject ? 'Regarding: ' + subject + '\n\n' : '') + f.get('message'),
          website: f.get('website'),
          consent: f.has('consent'),
          token,
        }),
      });
      const v = await readApiResponse<{ error?: string; reference: string; email: string }>(r);
      if (!r.ok) throw Error(v.error);
      setSent(true);
      setMessage(
        'Thank you. Your enquiry has been received. Reference: ' +
          String(v.reference) +
          ' — ' +
          (v.email === 'accepted'
            ? 'A confirmation email has been accepted for sending. Check your inbox and spam folder.'
            : 'Your enquiry is saved. Email confirmation is pending.'),
      );
    } catch (e) {
      setMessage((e as Error).message);
      if (widget.current) window.turnstile?.reset(widget.current);
      setToken('');
    } finally {
      setBusy(false);
    }
  };
  if (!config) return <p role="status">Preparing the enquiry form…</p>;
  if (!config.formsReady)
    return (
      <div className="notice">
        <h3>Let’s stay connected.</h3>
        <p>
          Our online enquiry service and official contact details are being prepared. Please check
          back for confirmed ways to contact the foundation.
        </p>
      </div>
    );
  return (
    <form
      className="enquiry-form"
      onChange={() => {
        submission.current = null;
      }}
      onSubmit={submit}
    >
      {message && (
        <p role={sent ? 'status' : 'alert'} className="notice">
          {message}
        </p>
      )}
      {!sent && (
        <>
          <label>
            I would like to…
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="contact">Make a general enquiry</option>
              <option value="volunteer">Volunteer</option>
              <option value="partner">Discuss a partnership</option>
              <option value="aminia-kids">Ask about Aminia Kids (parent/guardian)</option>
              <option value="support">Support the foundation</option>
              <option value="merchandise">Request AHF merchandise</option>
              <option value="event">Ask about an event</option>
            </select>
          </label>
          <div className="form-grid">
            <label>
              Your name
              <input required name="name" autoComplete="name" maxLength={150} />
            </label>
            <label>
              Email address
              <input required type="email" name="email" autoComplete="email" maxLength={254} />
            </label>
          </div>
          <label>
            Telephone (optional)
            <input name="phone" type="tel" autoComplete="tel" maxLength={50} />
          </label>
          <label>
            Programme / event / product (optional)
            <input value={subject} maxLength={180} onChange={(e) => setSubject(e.target.value)} />
          </label>
          {kind === 'merchandise' && (
            <p className="fine">
              Include the product, quantity, size/colour and collection or delivery preference.
              Payment details are not collected here.
            </p>
          )}
          <label>
            Your message
            <textarea required name="message" minLength={5} maxLength={4700} rows={5} />
          </label>
          <p className="fine">
            For Aminia Kids, use the parent or guardian’s contact details. Leave children’s names,
            private case information and identity documents out of this form.
          </p>
          <label className="honeypot" aria-hidden="true">
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <label className="checkbox">
            <input required name="consent" type="checkbox" />I agree to AHF using these details to
            respond to this enquiry. <AppLink href="/privacy">Privacy information</AppLink>
          </label>
          <div ref={holder} />
          <button className="btn green" disabled={busy || !token}>
            {busy ? 'Sending…' : 'Send enquiry'} ↗
          </button>
        </>
      )}
    </form>
  );
}
