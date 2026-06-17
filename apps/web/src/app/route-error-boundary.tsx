import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/shared/components/ui/button";

import { Sentry } from "./sentry.js";

type RouteErrorBoundaryProps = {
  children: ReactNode;
};

type RouteErrorBoundaryState = {
  hasError: boolean;
};

export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError = () => ({
    hasError: true
  });

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack
        }
      }
    });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return <RouteErrorFallback />;
  }
}

const RouteErrorFallback = () => (
  <main className="min-h-screen bg-base px-4 py-12 text-primary">
    <section
      className="mx-auto flex max-w-xl flex-col gap-4 rounded-2xl border border-default bg-surface p-6 shadow-card"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span className="rounded-lg border border-default bg-inset p-2 text-error">
          <AlertTriangle className="size-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            ThreadSync hit an unexpected error. Refresh the page and try again.
          </p>
        </div>
      </div>
      <Button
        className="self-start"
        type="button"
        onClick={() => window.location.reload()}
      >
        <RotateCcw className="size-4" />
        Refresh
      </Button>
    </section>
  </main>
);

