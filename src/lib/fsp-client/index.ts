// ---------------------------------------------------------------------------
// FSP Client Factory
// Returns the appropriate IFspClient based on environment configuration.
// ---------------------------------------------------------------------------

import { getEnv } from "@/config/env";
import type { IFspClient } from "./types";
import { MockFspClient } from "./mock";
import { RealFspClient } from "./client";

export function createFspClient(): IFspClient {
  const env = getEnv();
  if (env.FSP_ENVIRONMENT === "mock") {
    return new MockFspClient();
  }
  return new RealFspClient(env);
}

export type { IFspClient } from "./types";
export type {
  FindATimeParams,
  ScheduleQueryParams,
  SchedulableEventsParams,
  ReservationListParams,
} from "./types";
export { MockFspClient } from "./mock";
export type { MockScenario, MockFspClientOptions } from "./mock";
