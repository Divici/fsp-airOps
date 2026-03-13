// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getEnv, resetEnvCache } from "../env";

describe("getEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetEnvCache();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    resetEnvCache();
  });

  it("defaults to mock mode when FSP_ENVIRONMENT is not set", () => {
    // Clear any existing vars
    delete process.env.DATABASE_URL;
    delete process.env.FSP_API_BASE_URL;
    delete process.env.FSP_CORE_BASE_URL;
    delete process.env.FSP_CURRICULUM_BASE_URL;
    delete process.env.FSP_SUBSCRIPTION_KEY;
    delete process.env.FSP_ENVIRONMENT;

    const env = getEnv();
    expect(env.FSP_ENVIRONMENT).toBe("mock");
    expect(env.DATABASE_URL).toBe(
      "postgresql://localhost:5432/fsp_airops_mock"
    );
    expect(env.FSP_SUBSCRIPTION_KEY).toBe("mock-subscription-key");
  });

  it("uses mock defaults when FSP_ENVIRONMENT is mock", () => {
    process.env.FSP_ENVIRONMENT = "mock";
    delete process.env.DATABASE_URL;
    delete process.env.FSP_API_BASE_URL;

    const env = getEnv();
    expect(env.DATABASE_URL).toContain("mock");
    expect(env.FSP_API_BASE_URL).toContain("mock");
  });

  it("allows overriding mock defaults", () => {
    process.env.FSP_ENVIRONMENT = "mock";
    process.env.DATABASE_URL = "postgresql://custom:5432/mydb";

    const env = getEnv();
    expect(env.DATABASE_URL).toBe("postgresql://custom:5432/mydb");
  });

  it("fails fast when required vars are missing in production mode", () => {
    process.env.FSP_ENVIRONMENT = "production";
    delete process.env.DATABASE_URL;
    delete process.env.FSP_API_BASE_URL;
    delete process.env.FSP_CORE_BASE_URL;
    delete process.env.FSP_CURRICULUM_BASE_URL;
    delete process.env.FSP_SUBSCRIPTION_KEY;

    expect(() => getEnv()).toThrow("Missing required environment variables");
  });

  it("fails fast when required vars are missing in develop mode", () => {
    process.env.FSP_ENVIRONMENT = "develop";
    delete process.env.DATABASE_URL;

    expect(() => getEnv()).toThrow("Missing required environment variables");
  });

  it("succeeds in production mode when all required vars are set", () => {
    process.env.FSP_ENVIRONMENT = "production";
    process.env.DATABASE_URL = "postgresql://prod:5432/fsp";
    process.env.FSP_API_BASE_URL = "https://api.fsp.com";
    process.env.FSP_CORE_BASE_URL = "https://core.fsp.com";
    process.env.FSP_CURRICULUM_BASE_URL = "https://curriculum.fsp.com";
    process.env.FSP_SUBSCRIPTION_KEY = "real-key";

    const env = getEnv();
    expect(env.FSP_ENVIRONMENT).toBe("production");
    expect(env.DATABASE_URL).toBe("postgresql://prod:5432/fsp");
  });

  it("caches the result on subsequent calls", () => {
    process.env.FSP_ENVIRONMENT = "mock";
    const first = getEnv();
    const second = getEnv();
    expect(first).toBe(second);
  });

  it("rejects invalid FSP_ENVIRONMENT values", () => {
    process.env.FSP_ENVIRONMENT = "invalid";

    expect(() => getEnv()).toThrow();
  });

  it("validates NEXT_PUBLIC_APP_URL as a URL when provided", () => {
    process.env.FSP_ENVIRONMENT = "mock";
    process.env.NEXT_PUBLIC_APP_URL = "not-a-url";

    expect(() => getEnv()).toThrow();
  });

  it("accepts valid optional NEXT_PUBLIC_APP_URL", () => {
    process.env.FSP_ENVIRONMENT = "mock";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";

    const env = getEnv();
    expect(env.NEXT_PUBLIC_APP_URL).toBe("https://app.example.com");
  });
});
