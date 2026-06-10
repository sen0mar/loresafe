import { ApiError } from "../../../shared/api/api-client.js";
import { useHealthQuery } from "../api/health.js";

export const HomePage = () => {
  const healthQuery = useHealthQuery();

  return (
    <main className="home-shell">
      <section className="health-panel" aria-labelledby="health-title">
        <p className="eyebrow">ThreadSync foundation</p>
        <h1 id="health-title">API health</h1>

        {healthQuery.isPending ? (
          <HealthLoading />
        ) : healthQuery.isError ? (
          <HealthError
            error={healthQuery.error}
            isRetrying={healthQuery.isFetching}
            onRetry={() => void healthQuery.refetch()}
          />
        ) : (
          <HealthSuccess
            appName={healthQuery.data.appName}
            status={healthQuery.data.status}
            timestamp={healthQuery.data.timestamp}
            isRefreshing={healthQuery.isFetching}
            onRefresh={() => void healthQuery.refetch()}
          />
        )}
      </section>
    </main>
  );
};

const HealthLoading = () => (
  <div className="health-state" role="status">
    <span className="status-dot status-dot--pending" />
    <div>
      <h2>Checking live API status</h2>
      <p>Waiting for the ThreadSync backend to respond.</p>
    </div>
  </div>
);

const HealthError = ({
  error,
  isRetrying,
  onRetry
}: {
  error: Error;
  isRetrying: boolean;
  onRetry: () => void;
}) => (
  <div className="health-state health-state--error" role="alert">
    <span className="status-dot status-dot--error" />
    <div>
      <h2>API request failed</h2>
      <p>{getErrorMessage(error)}</p>
      {error instanceof ApiError && error.requestId ? (
        <p className="request-id">Request ID: {error.requestId}</p>
      ) : null}
      <button type="button" onClick={onRetry} disabled={isRetrying}>
        {isRetrying ? "Retrying..." : "Retry"}
      </button>
    </div>
  </div>
);

const HealthSuccess = ({
  appName,
  status,
  timestamp,
  isRefreshing,
  onRefresh
}: {
  appName: string;
  status: "ok";
  timestamp: string;
  isRefreshing: boolean;
  onRefresh: () => void;
}) => (
  <div className="health-card">
    <div className="health-state">
      <span className="status-dot status-dot--ok" />
      <div>
        <h2>{appName}</h2>
        <p>Live API response received.</p>
      </div>
    </div>

    <dl>
      <div>
        <dt>Status</dt>
        <dd>{status}</dd>
      </div>
      <div>
        <dt>Timestamp</dt>
        <dd>{new Date(timestamp).toLocaleString()}</dd>
      </div>
      <div>
        <dt>Raw timestamp</dt>
        <dd>{timestamp}</dd>
      </div>
    </dl>

    <button type="button" onClick={onRefresh} disabled={isRefreshing}>
      {isRefreshing ? "Refreshing..." : "Refresh"}
    </button>
  </div>
);

const getErrorMessage = (error: Error) =>
  error.message || "Something went wrong while calling the API.";
