import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — set up before importing the module under test
// ---------------------------------------------------------------------------

const mockGetActiveOperatorIds = vi.fn<() => Promise<number[]>>();
const mockExpireStaleProposals = vi.fn<(db: unknown, operatorId: number) => Promise<number>>();
const mockLogEvent = vi.fn<() => Promise<void>>();

vi.mock("@/lib/db", () => ({
  db: {},
}));

vi.mock("@/lib/db/queries/operators", () => ({
  getActiveOperatorIds: (...args: unknown[]) => mockGetActiveOperatorIds(...(args as [])),
}));

vi.mock("@/lib/db/queries/proposals", () => ({
  expireStaleProposals: (db: unknown, operatorId: number) =>
    mockExpireStaleProposals(db, operatorId),
}));

vi.mock("@/lib/engine/audit", () => ({
  AuditService: vi.fn().mockImplementation(() => ({
    logEvent: mockLogEvent,
  })),
}));

vi.mock("@/lib/observability", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Inngest to capture the function handler
// eslint-disable-next-line no-var -- var needed for hoisting compatibility with vi.mock
var capturedHandler: (args: { step: ReturnType<typeof createMockStep> }) => Promise<unknown>;

function createMockStep() {
  return {
    run: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
    sendEvent: vi.fn(),
  };
}

vi.mock("@/inngest/client", () => ({
  inngest: {
    createFunction: (
      _config: unknown,
      _trigger: unknown,
      handler: typeof capturedHandler
    ) => {
      capturedHandler = handler;
      return handler;
    },
  },
}));

// Import after mocks
import "../expire-proposals";

describe("expireProposalsCron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("expires stale proposals for each active operator", async () => {
    mockGetActiveOperatorIds.mockResolvedValue([1, 2]);
    mockExpireStaleProposals.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    mockLogEvent.mockResolvedValue(undefined);

    const step = createMockStep();
    const result = await capturedHandler({ step });

    expect(mockExpireStaleProposals).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      expired: 4,
      operatorCount: 2,
    });
  });

  it("returns no-op when no active operators exist", async () => {
    mockGetActiveOperatorIds.mockResolvedValue([]);

    const step = createMockStep();
    const result = await capturedHandler({ step });

    expect(result).toMatchObject({
      expired: 0,
    });
    expect(mockExpireStaleProposals).not.toHaveBeenCalled();
  });

  it("creates audit events only when proposals are actually expired", async () => {
    mockGetActiveOperatorIds.mockResolvedValue([1, 2]);
    mockExpireStaleProposals.mockResolvedValueOnce(0).mockResolvedValueOnce(5);
    mockLogEvent.mockResolvedValue(undefined);

    const step = createMockStep();
    await capturedHandler({ step });

    // Only operator 2 had expirations, so only one audit event
    expect(mockLogEvent).toHaveBeenCalledTimes(1);
    expect(mockLogEvent).toHaveBeenCalledWith(
      2,
      "proposal_expired",
      expect.objectContaining({
        entityType: "proposal",
        payload: { count: 5, reason: "stale_expiration" },
      })
    );
  });
});
