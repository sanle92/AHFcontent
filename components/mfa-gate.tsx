'use client';
import AppImage from './app-image';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, LoaderCircle, ShieldCheck } from 'lucide-react';
import {
  authRequest,
  verifyTotp,
  type AuthSession,
  type Factor,
  type Enrollment,
} from '@/lib/auth-client';
import { organization } from '@/lib/organization';
export default function MfaGate({
  config,
  session,
  onVerified,
  onCancel,
}: {
  config: { url: string; key: string };
  session: AuthSession;
  onVerified: (s: AuthSession) => void;
  onCancel: () => void;
}) {
  const [factors, setFactors] = useState<Factor[]>([]),
    [factorId, setFactorId] = useState(''),
    [enrollment, setEnrollment] = useState<Enrollment | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    authRequest<{ factors?: Factor[] }>(config, session.access_token, '/user')
      .then((user) => {
        if (cancelled) return;
        const verified = (user.factors || []).filter(
          (f) => f.factor_type === 'totp' && f.status === 'verified',
        );
        setFactors(verified);
        setFactorId(verified[0]?.id || '');
      })
      .catch(() => {
        if (!cancelled)
          setError('Unable to load your authentication settings. Try signing in again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [config, session.access_token]);
  const enroll = async () => {
    setBusy(true);
    setError('');
    try {
      // Remove only abandoned, unverified TOTP enrollments on this user's account.
      // Verified factors are never removed by the enrollment flow.
      const user = await authRequest<{ factors?: Factor[] }>(config, session.access_token, '/user');
      const verified = (user.factors || []).filter(
        (f) => f.factor_type === 'totp' && f.status === 'verified',
      );
      if (verified.length) {
        setFactors(verified);
        setFactorId(verified[0].id);
        return;
      }
      for (const f of user.factors || [])
        if (f.factor_type === 'totp' && f.status === 'unverified')
          await authRequest(config, session.access_token, `/factors/${encodeURIComponent(f.id)}`, {
            method: 'DELETE',
          });
      const value = await authRequest<Enrollment>(config, session.access_token, '/factors', {
        method: 'POST',
        body: JSON.stringify({
          factor_type: 'totp',
          friendly_name: 'AHF authenticator',
          issuer: 'Aminia Hope Foundation',
        }),
      });
      setEnrollment(value);
      setFactorId(value.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get('code') || '');
    setBusy(true);
    setError('');
    try {
      onVerified(await verifyTotp(config, session.access_token, factorId, code));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-screen">
      <div className="auth-card mfa-card">
        <AppImage
          className="auth-official-logo"
          src={organization.logo}
          alt="Aminia Hope Foundation logo"
        />
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        {loading ? (
          <LoaderCircle className="spin" size={24} />
        ) : !factorId ? (
          <button
            className="button primary"
            onClick={() => void enroll()}
            disabled={busy || loading}
          >
            Set up authenticator
            <ArrowRight size={16} />
          </button>
        ) : (
          <>
            {enrollment && (
              <div className="mfa-enrollment">
                <AppImage
                  src={
                    'data:image/svg+xml;charset=utf-8,' +
                    encodeURIComponent(enrollment.totp.qr_code)
                  }
                  alt="Scan this QR code with your authenticator app"
                />
                <p>Scan with an authenticator app, or enter this setup key manually:</p>
                <code>{enrollment.totp.secret}</code>
                <p className="fine">
                  Keep this key private. It is shown only while setting up your authenticator.
                </p>
              </div>
            )}
            <form onSubmit={verify}>
              {factors.length > 1 && (
                <label>
                  Authenticator
                  <select value={factorId} onChange={(e) => setFactorId(e.target.value)}>
                    {factors.map((f) => (
                      <option value={f.id} key={f.id}>
                        {f.friendly_name || 'Authenticator'}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Six-digit code
                <input
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="000000"
                />
              </label>
              <button className="button primary" disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={16} /> : <ShieldCheck size={16} />}
                Verify & open workspace
              </button>
            </form>
          </>
        )}
        <button className="text-button mfa-cancel" style={{ marginTop: '20px' }} onClick={onCancel}>
          Back to sign-in
        </button>
        <p className="fine">
          If you lose your authenticator, contact AHF’s authorized account administrator for
          recovery.
        </p>
      </div>
    </div>
  );
}
