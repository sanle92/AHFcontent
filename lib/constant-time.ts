import { createHash, timingSafeEqual } from 'node:crypto';
export function constantTimeEqual(left: string, right: string) {
  return timingSafeEqual(
    createHash('sha256').update(left).digest(),
    createHash('sha256').update(right).digest(),
  );
}
