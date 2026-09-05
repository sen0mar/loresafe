import type { QueryClient } from "@tanstack/react-query";

// Kept outside the cache so clearing it cannot make an old generation current.
const generations = new WeakMap<QueryClient, number>();

export const getAuthGeneration = (client: QueryClient) =>
  generations.get(client) ?? 0;

export const advanceAuthGeneration = (client: QueryClient) => {
  const generation = getAuthGeneration(client) + 1;
  generations.set(client, generation);
  return generation;
};
