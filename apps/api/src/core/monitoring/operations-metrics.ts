type HttpMetric = {
  count: number;
  durationMs: number;
};

export const MAX_HTTP_METRIC_SERIES = 512;

const httpMetrics = new Map<string, HttpMetric>();
const readinessDurations = new Map<string, number>();
let droppedHttpMetricSeries = 0;
let storageCleanupCompleted = 0;
let storageCleanupFailed = 0;

export const operationsMetrics = {
  recordHttpRequest: (
    method: string,
    path: string,
    statusCode: number,
    durationMs: number
  ) => {
    const key = JSON.stringify([method, path, statusCode]);
    const current = httpMetrics.get(key);

    if (!current && httpMetrics.size >= MAX_HTTP_METRIC_SERIES) {
      droppedHttpMetricSeries += 1;
      return;
    }

    httpMetrics.set(key, {
      count: (current?.count ?? 0) + 1,
      durationMs: (current?.durationMs ?? 0) + durationMs
    });
  },
  recordReadinessDuration: (dependency: string, durationMs: number) => {
    readinessDurations.set(dependency, durationMs);
  },
  recordStorageCleanup: (completed: number, failed: number) => {
    storageCleanupCompleted += completed;
    storageCleanupFailed += failed;
  }
};

export const renderOperationsMetrics = ({
  eventConnections
}: {
  eventConnections: number;
}) => {
  const lines = [
    "# TYPE loresafe_http_requests_total counter",
    ...[...httpMetrics.entries()].flatMap(([key, metric]) => {
      const [method, path, statusCode] = JSON.parse(key) as [
        string,
        string,
        number
      ];
      const labels = `method="${escapeLabel(method)}",path="${escapeLabel(path)}",status="${statusCode}"`;
      return [
        `loresafe_http_requests_total{${labels}} ${metric.count}`,
        `loresafe_http_request_duration_ms_sum{${labels}} ${metric.durationMs}`,
        `loresafe_http_request_duration_ms_count{${labels}} ${metric.count}`
      ];
    }),
    "# TYPE loresafe_readiness_dependency_duration_ms gauge",
    ...[...readinessDurations.entries()].map(
      ([dependency, durationMs]) =>
        `loresafe_readiness_dependency_duration_ms{dependency="${escapeLabel(dependency)}"} ${durationMs}`
    ),
    `loresafe_http_metric_series_dropped_total ${droppedHttpMetricSeries}`,
    `loresafe_sse_connections ${eventConnections}`,
    `loresafe_storage_cleanup_completed_total ${storageCleanupCompleted}`,
    `loresafe_storage_cleanup_failed_total ${storageCleanupFailed}`
  ];

  return `${lines.join("\n")}\n`;
};

const escapeLabel = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

export const resetOperationsMetricsForTests = () => {
  httpMetrics.clear();
  readinessDurations.clear();
  droppedHttpMetricSeries = 0;
  storageCleanupCompleted = 0;
  storageCleanupFailed = 0;
};
