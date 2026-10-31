'use client';
import { useSyncExternalStore } from 'react';
let current = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((notify) => notify());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}
export function useClock() {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => 0,
  );
}
