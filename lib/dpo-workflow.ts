import { dpoCheckoutUrl } from './dpo-checkout.ts';

/** Payment orchestration only; public checkout is not enabled. */
export interface DonationReservation {
  created: boolean;
  status: 'pending' | 'confirmed' | 'needs_review';
  token_bound: boolean;
}
export interface DonationRequest {
  reference: string;
  amountMinor: number;
  currency: 'UGX' | 'USD';
  purpose: string;
}
export interface CheckoutDependencies {
  reserve: (input: DonationRequest) => Promise<DonationReservation>;
  create: (input: DonationRequest) => Promise<{ token: string; checkoutUrl: string }>;
  bind: (reference: string, token: string) => Promise<boolean>;
}
export async function prepareDonation(input: DonationRequest, deps: CheckoutDependencies) {
  const reservation = await deps.reserve(input);
  if (!reservation.created) return { state: 'needs_reconciliation' as const };
  let provider: { token: string; checkoutUrl: string };
  try {
    provider = await deps.create(input);
  } catch {
    return { state: 'needs_reconciliation' as const };
  }
  try {
    if (dpoCheckoutUrl(provider.token) !== provider.checkoutUrl)
      return { state: 'needs_reconciliation' as const };
    if (!(await deps.bind(input.reference, provider.token)))
      return { state: 'needs_reconciliation' as const };
  } catch {
    return { state: 'needs_reconciliation' as const };
  }
  return { state: 'ready' as const, checkoutUrl: provider.checkoutUrl };
}

export interface ReconciliationRecord extends DonationRequest {
  token: string;
  status: 'pending' | 'confirmed' | 'needs_review';
}

/** The record must come from the private ledger, never from a callback body. */
export interface ReconciliationDependencies {
  verify: (record: ReconciliationRecord) => Promise<{ confirmed: boolean }>;
  confirm: (record: ReconciliationRecord) => Promise<boolean>;
  acknowledge: (record: ReconciliationRecord) => Promise<{ confirmed: boolean }>;
}

/** Callback data is a trigger only. Fail closed and allow acknowledgement retries. */
export async function reconcileDonation(
  record: ReconciliationRecord,
  deps: ReconciliationDependencies,
) {
  if (record.status === 'needs_review') return { state: 'needs_review' as const };
  try {
    const verified = await deps.verify(record);
    if (!verified.confirmed) return { state: 'needs_review' as const };
    if (!(await deps.confirm(record))) return { state: 'needs_review' as const };
  } catch {
    return { state: 'retry' as const };
  }
  try {
    const acknowledged = await deps.acknowledge(record);
    return {
      state: acknowledged.confirmed ? ('confirmed' as const) : ('acknowledgement_pending' as const),
    };
  } catch {
    return { state: 'acknowledgement_pending' as const };
  }
}
