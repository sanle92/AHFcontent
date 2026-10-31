// This only reads an assurance claim. It DOES NOT verify JWT signatures.
// Server callers must validate the bearer token with Supabase /user first.
export function hasSecondFactor(token: string): boolean {
  try {
    const part = token.split('.')[1];
    if (!part) return false;
    const encoded = part.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(encoded + '='.repeat((4 - (encoded.length % 4)) % 4))).aal === 'aal2';
  } catch {
    return false;
  }
}
