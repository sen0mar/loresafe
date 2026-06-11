import type { ReactNode } from "react";
import { Check, Clock3, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/shared/components/ui/dialog";
import { Skeleton } from "@/shared/components/ui/skeleton";

import { ApiError } from "../../../shared/api/api-client.js";
import type { HealthResponse } from "../api/health.js";

type HealthStatusPanelProps = {
  data?: HealthResponse;
  error: Error | null;
  isPending: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
};

export const HealthStatusPanel = ({
  data,
  error,
  isPending,
  isRefreshing,
  onRefresh
}: HealthStatusPanelProps) => (
  <Card>
    <CardHeader className="flex-row items-start justify-between gap-3">
      <div>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-brand" />
          Backend connectivity
        </CardTitle>
        <CardDescription>
          Live shell check for <code className="font-mono text-brand">/api/health</code>
        </CardDescription>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={onRefresh}
        disabled={isRefreshing}
      >
        <RefreshCw className={isRefreshing ? "animate-spin" : undefined} />
        Refresh
      </Button>
    </CardHeader>
    <CardContent>
      {isPending ? (
        <HealthLoading />
      ) : error ? (
        <HealthError error={error} />
      ) : data ? (
        <HealthSuccess data={data} />
      ) : null}
    </CardContent>
  </Card>
);

const HealthLoading = () => (
  <div className="grid gap-3 sm:grid-cols-3">
    <Skeleton className="h-20" />
    <Skeleton className="h-20" />
    <Skeleton className="h-20" />
  </div>
);

const HealthError = ({ error }: { error: Error }) => (
  <div className="rounded-xl border border-default bg-inset p-4" role="alert">
    <div className="flex items-start gap-3">
      <span className="mt-1 size-3 rounded-full bg-error" />
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-primary">API request failed</h2>
        <p className="mt-1 text-sm leading-5 text-muted">{getErrorMessage(error)}</p>
        {error instanceof ApiError && error.requestId ? (
          <p className="mt-2 break-words font-mono text-xs text-faint">
            Request ID: {error.requestId}
          </p>
        ) : null}
      </div>
    </div>
  </div>
);

const HealthSuccess = ({ data }: { data: HealthResponse }) => (
  <div className="grid gap-3 sm:grid-cols-3">
    <Metric label="Status" value={data.status} icon={<Check className="size-4" />} />
    <Metric
      label="App"
      value={data.appName}
      icon={<ShieldCheck className="size-4" />}
    />
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="rounded-xl border border-default bg-inset p-4 text-left transition-colors hover:border-strong hover:bg-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <span className="flex items-center gap-2 text-xs text-faint">
            <Clock3 className="size-4" />
            Timestamp
          </span>
          <span className="mt-2 block truncate font-mono text-sm text-primary">
            {new Date(data.timestamp).toLocaleString()}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Health response</DialogTitle>
          <DialogDescription>
            The shell is receiving JSON from the backend health endpoint.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-default bg-inset p-3 font-mono text-sm text-muted">
          {data.timestamp}
        </div>
      </DialogContent>
    </Dialog>
  </div>
);

const Metric = ({
  label,
  value,
  icon
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) => (
  <div className="rounded-xl border border-default bg-inset p-4">
    <span className="flex items-center gap-2 text-xs text-faint">
      {icon}
      {label}
    </span>
    <p className="mt-2 truncate font-mono text-sm text-primary">{value}</p>
  </div>
);

const getErrorMessage = (error: Error) =>
  error.message || "Something went wrong while calling the API.";
