import { prisma } from "../../core/prisma/client.js";
import { checkUpstashRedisReady } from "../../core/security/upstash-rate-limit-store.js";
import { r2Storage } from "../../core/storage/r2-storage.js";
import { operationsMetrics } from "../../core/monitoring/operations-metrics.js";

export type ReadinessDependencyName = "database" | "redis" | "storage";

export type ReadinessDependencies = Record<
  ReadinessDependencyName,
  () => Promise<void>
>;

export type ReadinessCheck = {
  durationMs: number;
  status: "ready" | "unavailable";
};

export type ReadinessResult = {
  checks: Record<ReadinessDependencyName, ReadinessCheck>;
  status: "ready" | "degraded";
};

const readinessTimeoutMs = 2_000;

const defaultReadinessDependencies: ReadinessDependencies = {
  database: async () => {
    await prisma.$queryRaw`SELECT 1`;
  },
  redis: checkUpstashRedisReady,
  storage: async () => {
    if (!r2Storage.checkReady) {
      throw new Error("Storage readiness is not configured.");
    }

    await r2Storage.checkReady();
  }
};

export const checkReadiness = async (
  dependencies: ReadinessDependencies = defaultReadinessDependencies
): Promise<ReadinessResult> => {
  const entries = await Promise.all(
    Object.entries(dependencies).map(async ([name, check]) => {
      const startedAt = performance.now();
      let status: ReadinessCheck["status"] = "ready";

      try {
        await withDeadline(check(), readinessTimeoutMs);
      } catch {
        status = "unavailable";
      }

      const durationMs = Math.round(performance.now() - startedAt);
      operationsMetrics.recordReadinessDuration(name, durationMs);

      return [name as ReadinessDependencyName, { durationMs, status }] as const;
    })
  );
  const checks = Object.fromEntries(entries) as ReadinessResult["checks"];

  return {
    checks,
    status: entries.every(([, check]) => check.status === "ready")
      ? "ready"
      : "degraded"
  };
};

const withDeadline = <T>(promise: Promise<T>, timeoutMs: number) =>
  new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Readiness check timed out.")),
      timeoutMs
    );

    promise.then(resolve, reject).finally(() => clearTimeout(timeout));
  });
