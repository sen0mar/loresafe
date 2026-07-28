import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  MAX_HTTP_METRIC_SERIES,
  operationsMetrics,
  renderOperationsMetrics,
  resetOperationsMetricsForTests
} from "./operations-metrics.js";

describe("operationsMetrics", () => {
  beforeEach(() => {
    resetOperationsMetricsForTests();
  });

  afterEach(() => {
    resetOperationsMetricsForTests();
  });

  it("bounds the number of HTTP metric series", () => {
    for (let index = 0; index <= MAX_HTTP_METRIC_SERIES; index += 1) {
      operationsMetrics.recordHttpRequest("GET", `/api/route-${index}`, 200, 1);
    }

    const metrics = renderOperationsMetrics({ eventConnections: 0 });
    const requestSeries = metrics
      .split("\n")
      .filter((line) => line.startsWith("loresafe_http_requests_total{"));

    expect(requestSeries).toHaveLength(MAX_HTTP_METRIC_SERIES);
    expect(metrics).toContain("loresafe_http_metric_series_dropped_total 1");
  });
});
