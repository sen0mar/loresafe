import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { vi } from "vitest";

type MockRoute = {
  method?: string;
  path: string | RegExp;
  response:
    | unknown
    | ((request: {
        body: unknown;
        method: string;
        searchParams: URLSearchParams;
        url: URL;
      }) => unknown);
  status?: number;
};

export const renderWithProviders = (
  ui: ReactElement,
  options: {
    initialEntries?: string[];
    routeObserver?: (path: string) => void;
  } = {}
) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false
      },
      queries: {
        retry: false
      }
    }
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={options.initialEntries ?? ["/"]}>
        {options.routeObserver ? (
          <RouteObserver onChange={options.routeObserver} />
        ) : null}
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );

  return {
    queryClient,
    ...render(ui, { wrapper: Wrapper })
  };
};

export const mockFetchRoutes = (routes: MockRoute[]) => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = normalizeRequest(input, init);
    const route = routes.find(
      (candidate) =>
        (candidate.method ?? "GET") === request.method &&
        (typeof candidate.path === "string"
          ? candidate.path === request.url.pathname
          : candidate.path.test(request.url.pathname))
    );

    if (!route) {
      throw new Error(`Unhandled fetch ${request.method} ${request.url.pathname}`);
    }

    const payload =
      typeof route.response === "function"
        ? route.response(request)
        : route.response;

    return Response.json(payload, {
      status: route.status ?? 200
    });
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
};

export const getJsonRequestBody = (call: unknown[]) => {
  const init = call[1] as RequestInit | undefined;

  return typeof init?.body === "string" ? JSON.parse(init.body) : null;
};

const RouteObserver = ({ onChange }: { onChange: (path: string) => void }) => {
  const location = useLocation();

  onChange(`${location.pathname}${location.search}`);

  return null;
};

const normalizeRequest = (input: RequestInfo | URL, init?: RequestInit) => {
  if (input instanceof Request) {
    return {
      body: null,
      method: input.method,
      url: new URL(input.url)
    };
  }

  const url = new URL(input.toString());

  return {
    body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
    method: init?.method ?? "GET",
    searchParams: url.searchParams,
    url
  };
};
