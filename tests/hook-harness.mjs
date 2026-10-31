// A small hook lifecycle driver for actual TSX components loaded by route-loader.
// Effects commit after render and clean up on dependency changes and unmount.
export function createHookHarness() {
  const slots = [];
  let cursor = 0,
    pending = [],
    mounted = true,
    lateUpdates = 0;
  const changed = (before, after) =>
    !before ||
    !after ||
    before.length !== after.length ||
    before.some((v, i) => !Object.is(v, after[i]));
  const useState = (initial) => {
    const i = cursor++;
    if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
    return [
      slots[i].value,
      (next) => {
        if (!mounted) {
          lateUpdates++;
          return;
        }
        slots[i].value = typeof next === 'function' ? next(slots[i].value) : next;
      },
    ];
  };
  const react = {
    useState,
    useRef: (initial) => useState(() => ({ current: initial }))[0],
    useEffect(effect, dependencies) {
      const i = cursor++;
      if (changed(slots[i]?.dependencies, dependencies)) pending.push({ i, effect, dependencies });
    },
    useCallback(callback, dependencies) {
      const i = cursor++;
      if (changed(slots[i]?.dependencies, dependencies)) slots[i] = { callback, dependencies };
      return slots[i].callback;
    },
  };
  return {
    react,
    render(Component, props) {
      if (!mounted) throw Error('Cannot render an unmounted component.');
      cursor = 0;
      pending = [];
      const tree = Component(props);
      for (const { i, effect, dependencies } of pending) {
        slots[i]?.cleanup?.();
        slots[i] = { dependencies, cleanup: effect() };
      }
      return tree;
    },
    unmount() {
      for (const slot of slots) slot?.cleanup?.();
      mounted = false;
    },
    get lateUpdates() {
      return lateUpdates;
    },
  };
}
export function findElement(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) return node.map((n) => findElement(n, predicate)).find(Boolean);
  return predicate(node) ? node : findElement(node.props?.children, predicate);
}
export const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));
