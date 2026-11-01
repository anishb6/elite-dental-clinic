import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

/**
 * `false` while the page is server-rendered and while React is hydrating it, `true` once the
 * component is running in the browser. (On a purely client-side render it is `true` immediately.)
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}
