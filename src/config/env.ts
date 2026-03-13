import { z } from "zod";

const MOCK_DEFAULTS = {
  DATABASE_URL: "postgresql://localhost:5432/fsp_airops_mock",
  FSP_API_BASE_URL: "http://localhost:3000/api/mock/fsp",
  FSP_CORE_BASE_URL: "http://localhost:3000/api/mock/fsp-core",
  FSP_CURRICULUM_BASE_URL: "http://localhost:3000/api/mock/fsp-curriculum",
  FSP_SUBSCRIPTION_KEY: "mock-subscription-key",
} as const;

const envSchema = z
  .object({
    DATABASE_URL: z.string().optional(),
    FSP_API_BASE_URL: z.string().optional(),
    FSP_CORE_BASE_URL: z.string().optional(),
    FSP_CURRICULUM_BASE_URL: z.string().optional(),
    FSP_SUBSCRIPTION_KEY: z.string().optional(),
    FSP_ENVIRONMENT: z
      .enum(["develop", "staging", "production", "mock"])
      .default("mock"),
    OPENAI_API_KEY: z.string().min(1).optional(),
    INNGEST_EVENT_KEY: z.string().optional(),
    INNGEST_SIGNING_KEY: z.string().optional(),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  })
  .transform((data) => {
    const isMock = data.FSP_ENVIRONMENT === "mock";

    if (isMock) {
      return {
        ...data,
        DATABASE_URL: data.DATABASE_URL || MOCK_DEFAULTS.DATABASE_URL,
        FSP_API_BASE_URL:
          data.FSP_API_BASE_URL || MOCK_DEFAULTS.FSP_API_BASE_URL,
        FSP_CORE_BASE_URL:
          data.FSP_CORE_BASE_URL || MOCK_DEFAULTS.FSP_CORE_BASE_URL,
        FSP_CURRICULUM_BASE_URL:
          data.FSP_CURRICULUM_BASE_URL ||
          MOCK_DEFAULTS.FSP_CURRICULUM_BASE_URL,
        FSP_SUBSCRIPTION_KEY:
          data.FSP_SUBSCRIPTION_KEY || MOCK_DEFAULTS.FSP_SUBSCRIPTION_KEY,
      };
    }

    const missing: string[] = [];
    if (!data.DATABASE_URL) missing.push("DATABASE_URL");
    if (!data.FSP_API_BASE_URL) missing.push("FSP_API_BASE_URL");
    if (!data.FSP_CORE_BASE_URL) missing.push("FSP_CORE_BASE_URL");
    if (!data.FSP_CURRICULUM_BASE_URL) missing.push("FSP_CURRICULUM_BASE_URL");
    if (!data.FSP_SUBSCRIPTION_KEY) missing.push("FSP_SUBSCRIPTION_KEY");

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables for ${data.FSP_ENVIRONMENT} mode: ${missing.join(", ")}`
      );
    }

    return data as Required<
      Pick<
        typeof data,
        | "DATABASE_URL"
        | "FSP_API_BASE_URL"
        | "FSP_CORE_BASE_URL"
        | "FSP_CURRICULUM_BASE_URL"
        | "FSP_SUBSCRIPTION_KEY"
      >
    > &
      typeof data;
  });

export type Env = z.output<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    try {
      const result = envSchema.safeParse(process.env);
      if (!result.success) {
        const formatted =
          "issues" in result.error
            ? result.error.issues
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join(", ")
            : String(result.error);
        console.error("Invalid environment variables:", formatted);
        throw new Error("Invalid environment configuration");
      }
      _env = result.data;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Missing required")) {
        console.error(err.message);
        throw err;
      }
      throw err;
    }
  }
  return _env;
}

/** Reset cached env (for testing) */
export function resetEnvCache(): void {
  _env = null;
}
