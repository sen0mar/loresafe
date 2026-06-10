import { useQuery } from "@tanstack/react-query";

import { apiGet } from "../../../shared/api/api-client.js";

export type HealthResponse = {
  appName: string;
  status: "ok";
  timestamp: string;
};

export const healthQueryKey = ["health"] as const;

export const useHealthQuery = () =>
  useQuery({
    queryKey: healthQueryKey,
    queryFn: () => apiGet<HealthResponse>("/api/health")
  });
