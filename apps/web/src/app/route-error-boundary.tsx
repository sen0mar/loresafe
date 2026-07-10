import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";
import { AlertTriangle, House, RotateCcw } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { Button } from "@/shared/components/ui/button";

import { Sentry } from "./sentry.js";

type RouteErrorBoundaryProps = {
  children: ReactNode;
};

type RouteErrorBoundaryStateProps = RouteErrorBoundaryProps & {
  resetKey: string;
};

type RouteErrorBoundaryStatus = {
  hasError: boolean;
};

class RouteErrorBoundaryState extends Component<
  RouteErrorBoundaryStateProps,
  RouteErrorBoundaryStatus
> {
  state: RouteErrorBoundaryStatus = {
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

  componentDidUpdate(previousProps: RouteErrorBoundaryStateProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return <RouteErrorFallback />;
  }
}

export const RouteErrorBoundary = ({ children }: RouteErrorBoundaryProps) => {
  const location = useLocation();

  return (
    <RouteErrorBoundaryState resetKey={location.key}>
      {children}
    </RouteErrorBoundaryState>
  );
};

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
            LoreSafe hit an unexpected error. Go somewhere safe or refresh and
            try again.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild className="self-start">
          <Link to="/">
            <House className="size-4" />
            Go home
          </Link>
        </Button>
        <Button
          className="self-start"
          type="button"
          variant="outline"
          onClick={() => window.location.reload()}
        >
          <RotateCcw className="size-4" />
          Refresh
        </Button>
      </div>
    </section>
  </main>
);
