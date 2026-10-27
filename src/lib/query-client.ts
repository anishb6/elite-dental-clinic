import { QueryClient } from "@tanstack/react-query";

/**
 * Single factory for the app's QueryClient (server state).
 * A new instance is created per router (i.e. per SSR request) so cached data is
 * never shared between visitors.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 1, staleTime: 60_000, refetchOnWindowFocus: false },
      // Never silently retry writes - a retried booking would create duplicates.
      mutations: { retry: false },
    },
  });
}
