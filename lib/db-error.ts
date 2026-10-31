import { BackendError, RequestError } from './http.ts';
export function dbError(value: { message?: string; code?: string }, status?: number): Error {
  if (status === 401) return new RequestError('Sign in again to continue.', 401);
  if (status === 403) return new RequestError('Access denied.', 403);
  if (['42P01', '42703', 'PGRST202', 'PGRST205'].includes(value.code || ''))
    return new BackendError(
      'Website database upgrade is incomplete. Apply the numbered website migrations in order, then reload the API schema.',
    );
  const message = value.message || '';
  if (message === 'Too many requests; please try again later.')
    return new RequestError(message, 429);
  if (message === 'Access denied.') return new RequestError(message, 403);
  if (message === 'Record changed; reload.') return new RequestError(message, 409);
  if (
    [
      'Return a record to draft before editing.',
      'A different publisher must approve this item.',
      'Transition not permitted.',
      'Explain the requested changes.',
      'Choose approved media before publication.',
      'Invalid content.',
      'Publish the related giving campaign first.',
      'That URL belongs to another publication.',
      'Fixed foundation page URLs cannot be changed.',
    ].includes(message)
  )
    return new RequestError(message);
  return new BackendError();
}
