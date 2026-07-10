type HttpMetric = {
  count: number;
  durationMs: number;
};

const httpMetrics = new Map<string, HttpMetric>();
const readinessDurations = new Map<string, number>();
const jobFailures = new Map<string, number>();
const jobLastAgeSeconds = new Map<string, number>();
let storageCleanupCompleted = 0;
let storageCleanupFailed = 0;

export const operationsMetrics = {
  recordHttpRequest: (method: string, path: string, statusCode: number, durationMs: number) => {
    const key = JSON.stringify([method, path, statusCode]);
    const current = httpMetrics.get(key) ?? { count: 0, durationMs: 0 };
    httpMetrics.set(key, {
      count: current.count + 1,
      durationMs: current.durationMs + durationMs
    });
  },
  recordReadinessDuration: (dependency: string, durationMs: number) => {
    readinessDurations.set(dependency, durationMs);
  },
  recordJob: (jobName: string, ageSeconds: number, failed: boolean) => {
    jobLastAgeSeconds.set(jobName, Math.max(0, ageSeconds));
    if (failed) {
      jobFailures.set(jobName, (jobFailures.get(jobName) ?? 0) + 1);
    }
  },
  recordStorageCleanup: (completed: number, failed: number) => {
    storageCleanupCompleted += completed;
    storageCleanupFailed += failed;
  }
};

export const renderOperationsMetrics = ({
  eventConnections,
  eventTransportReady,
  jobWorkerReady
}: {
  eventConnections: number;
  eventTransportReady: boolean;
  jobWorkerReady: boolean;
}) => {
  const lines = [
    "# TYPE loresafe_http_requests_total counter",
    ...[...httpMetrics.entries()].flatMap(([key, metric]) => {
      const [method, path, statusCode] = JSON.parse(key) as [string, string, number];
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
    `loresafe_job_worker_ready ${jobWorkerReady ? 1 : 0}`,
    ...[...jobFailures.entries()].map(
      ([jobName, count]) =>
        `loresafe_job_failures_total{job="${escapeLabel(jobName)}"} ${count}`
    ),
    ...[...jobLastAgeSeconds.entries()].map(
      ([jobName, age]) =>
        `loresafe_job_last_started_age_seconds{job="${escapeLabel(jobName)}"} ${age}`
    ),
    `loresafe_sse_transport_ready ${eventTransportReady ? 1 : 0}`,
    `loresafe_sse_connections ${eventConnections}`,
    `loresafe_storage_cleanup_completed_total ${storageCleanupCompleted}`,
    `loresafe_storage_cleanup_failed_total ${storageCleanupFailed}`
  ];

  return `${lines.join("\n")}\n`;
};

const escapeLabel = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
