import { useCallback } from "react";
import {
  useMutation,
  useQueryClient,
  type MutationFunctionContext,
  type UseMutationOptions,
  type UseMutationResult,
  type MutateOptions,
  type QueryClient
} from "@tanstack/react-query";

import { getAuthGeneration } from "./auth-generation";

type Invocation<TVariables> = {
  variables: TVariables;
  isCurrent: () => boolean;
  acceptAuthTransition: () => void;
};

type OwnedOptions<TData, TVariables, TContext> = Omit<
  UseMutationOptions<TData, Error, TVariables, TContext>,
  "onMutate" | "mutationFn"
> & {
  mutationFn: NonNullable<
    UseMutationOptions<TData, Error, TVariables, TContext>["mutationFn"]
  >;
  changesAuth?: boolean;
  // Keep optimistic writes synchronous; asynchronous preparation belongs in
  // mutationFn, whose start and response are both fenced below.
  onMutate?: (
    variables: TVariables,
    context: MutationFunctionContext
  ) => TContext;
};

export const useOwnedMutation = <
  TData,
  TVariables = void,
  TContext extends Record<string, unknown> | void = void
>(
  options: OwnedOptions<TData, TVariables, TContext>
): UseMutationResult<TData, Error, TVariables, TContext> => {
  const client = useQueryClient();
  const { changesAuth, ...mutationOptions } = options;
  const mutation = useMutation<TData, Error, Invocation<TVariables>, TContext>({
    ...mutationOptions,
    mutationFn: async (invocation, context) => {
      assertCurrent(invocation);
      const response = await options.mutationFn(invocation.variables, context);
      assertCurrent(invocation);
      return response;
    },
    onMutate: (invocation, context) => {
      assertCurrent(invocation);
      return options.onMutate?.(invocation.variables, context) as TContext;
    },
    ...guardCallbacks(options),
    onSuccess: async (data, invocation, result, context) => {
      assertCurrent(invocation);
      await options.onSuccess?.(data, invocation.variables, result, context);
      // Login/logout may advance exactly one generation themselves. Do not
      // bless a second, intervening transition while their callback awaited.
      if (changesAuth) invocation.acceptAuthTransition();
      assertCurrent(invocation);
    }
  });

  const { mutate: baseMutate, mutateAsync: baseMutateAsync } = mutation;
  const mutate = useCallback(
    (
      variables: TVariables,
      callbacks?: MutateOptions<TData, Error, TVariables, TContext>
    ) => {
      baseMutate(
        capture(client, variables),
        guardCallbacks<TData, TVariables, TContext | undefined>(callbacks)
      );
    },
    [client, baseMutate]
  );
  const mutateAsync = useCallback(
    async (
      variables: TVariables,
      callbacks?: MutateOptions<TData, Error, TVariables, TContext>
    ) => {
      const invocation = capture(client, variables);
      const response = await baseMutateAsync(
        invocation,
        guardCallbacks<TData, TVariables, TContext | undefined>(callbacks)
      );
      assertCurrent(invocation);
      return response;
    },
    [client, baseMutateAsync]
  );

  return {
    ...mutation,
    variables: mutation.variables?.variables,
    mutate,
    mutateAsync
  } as UseMutationResult<TData, Error, TVariables, TContext>;
};

const capture = <TVariables>(
  client: QueryClient,
  variables: TVariables
): Invocation<TVariables> => {
  // Capture at mutate(), before TanStack's asynchronous onMutate/queue work.
  let generation = getAuthGeneration(client);
  return {
    variables,
    isCurrent: () => getAuthGeneration(client) === generation,
    acceptAuthTransition: () => {
      if (getAuthGeneration(client) === generation + 1) generation += 1;
    }
  };
};

const assertCurrent = (invocation: Invocation<unknown>) => {
  if (!invocation.isCurrent()) {
    throw new Error("The session changed before the operation completed.");
  }
};

type Callbacks<TData, TVariables, TContext> = Pick<
  UseMutationOptions<TData, Error, TVariables, TContext>,
  "onSuccess" | "onError" | "onSettled"
>;

const guardCallbacks = <TData, TVariables, TContext>(
  callbacks?: Callbacks<TData, TVariables, TContext>
): Required<Callbacks<TData, Invocation<TVariables>, TContext>> => ({
  onSuccess: (data, invocation, result, context) => {
    if (invocation.isCurrent()) {
      return callbacks?.onSuccess?.(
        data,
        invocation.variables,
        result,
        context
      );
    }
  },
  onError: (error, invocation, result, context) => {
    if (invocation.isCurrent()) {
      return callbacks?.onError?.(error, invocation.variables, result, context);
    }
  },
  onSettled: (data, error, invocation, result, context) => {
    if (invocation.isCurrent()) {
      return callbacks?.onSettled?.(
        data,
        error,
        invocation.variables,
        result,
        context
      );
    }
  }
});
