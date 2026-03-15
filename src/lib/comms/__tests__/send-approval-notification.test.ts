import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies before importing
// ---------------------------------------------------------------------------

const mockSend = vi.fn().mockResolvedValue({ success: true, messageId: "msg-1" });

vi.mock("../communication-service", () => ({
  CommunicationService: vi.fn().mockImplementation(() => ({
    registerProvider: vi.fn(),
    send: (...args: unknown[]) => mockSend(...args),
  })),
}));

vi.mock("../email-provider", () => ({
  FspEmailProvider: vi.fn(),
}));

vi.mock("../sms-provider", () => ({
  SmsProvider: vi.fn(),
}));

const mockGetFlags = vi.fn();

vi.mock("@/lib/feature-flags/feature-flags", () => ({
  FeatureFlagService: vi.fn().mockImplementation(() => ({
    getFlags: (...args: unknown[]) => mockGetFlags(...args),
  })),
}));

import { sendApprovalNotification } from "../send-approval-notification";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockDb() {
  return {} as Parameters<typeof sendApprovalNotification>[0]["db"];
}

function makeProposal(overrides?: Record<string, unknown>) {
  return {
    id: "proposal-1",
    operatorId: 1,
    workflowType: "reschedule",
    triggerId: "trigger-1",
    status: "approved",
    summary: "Reschedule lesson",
    rationale: "Weather conflict",
    priority: 0,
    expiresAt: null,
    affectedStudentIds: ["student-1"],
    affectedReservationIds: [],
    affectedResourceIds: [],
    validationSnapshot: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    actions: [
      {
        id: "action-1",
        proposalId: "proposal-1",
        operatorId: 1,
        rank: 1,
        actionType: "create_reservation",
        startTime: new Date("2026-03-20T10:00:00Z"),
        endTime: new Date("2026-03-20T12:00:00Z"),
        locationId: 10,
        studentId: "student-1",
        instructorId: "instructor-1",
        aircraftId: "N12345",
        activityTypeId: "activity-1",
        trainingContext: null,
        explanation: "Test",
        validationStatus: "passed",
        executionStatus: "success",
        executionError: null,
        fspReservationId: "fsp-res-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sendApprovalNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends email when email notifications are enabled and email is provided", async () => {
    mockGetFlags.mockResolvedValue({
      enableEmailNotifications: true,
      enableSmsNotifications: false,
    });

    await sendApprovalNotification({
      db: makeMockDb(),
      operatorId: 1,
      proposal: makeProposal(),
      studentName: "Jane Doe",
      studentEmail: "jane@example.com",
      executionSuccess: true,
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "email",
        to: "jane@example.com",
        templateId: "reservation_created",
      })
    );
  });

  it("sends SMS when sms notifications are enabled and phone is provided", async () => {
    mockGetFlags.mockResolvedValue({
      enableEmailNotifications: false,
      enableSmsNotifications: true,
    });

    await sendApprovalNotification({
      db: makeMockDb(),
      operatorId: 1,
      proposal: makeProposal(),
      studentName: "Jane Doe",
      studentPhone: "+15551234567",
      executionSuccess: true,
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "sms",
        to: "+15551234567",
        templateId: "reservation_created",
      })
    );
  });

  it("sends both email and SMS when both are enabled", async () => {
    mockGetFlags.mockResolvedValue({
      enableEmailNotifications: true,
      enableSmsNotifications: true,
    });

    await sendApprovalNotification({
      db: makeMockDb(),
      operatorId: 1,
      proposal: makeProposal(),
      studentName: "Jane Doe",
      studentEmail: "jane@example.com",
      studentPhone: "+15551234567",
      executionSuccess: true,
    });

    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("uses proposal_approved template when execution failed", async () => {
    mockGetFlags.mockResolvedValue({
      enableEmailNotifications: true,
      enableSmsNotifications: false,
    });

    await sendApprovalNotification({
      db: makeMockDb(),
      operatorId: 1,
      proposal: makeProposal(),
      studentName: "Jane Doe",
      studentEmail: "jane@example.com",
      executionSuccess: false,
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: "proposal_approved",
      })
    );
  });

  it("does not send when email is enabled but no email provided", async () => {
    mockGetFlags.mockResolvedValue({
      enableEmailNotifications: true,
      enableSmsNotifications: false,
    });

    await sendApprovalNotification({
      db: makeMockDb(),
      operatorId: 1,
      proposal: makeProposal(),
      executionSuccess: true,
    });

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("does not throw when send fails", async () => {
    mockGetFlags.mockResolvedValue({
      enableEmailNotifications: true,
      enableSmsNotifications: false,
    });
    mockSend.mockRejectedValueOnce(new Error("SendGrid down"));

    // Should not throw
    await expect(
      sendApprovalNotification({
        db: makeMockDb(),
        operatorId: 1,
        proposal: makeProposal(),
        studentEmail: "jane@example.com",
        executionSuccess: true,
      })
    ).resolves.toBeUndefined();
  });

  it("does not throw when flag service fails", async () => {
    mockGetFlags.mockRejectedValueOnce(new Error("DB down"));

    await expect(
      sendApprovalNotification({
        db: makeMockDb(),
        operatorId: 1,
        proposal: makeProposal(),
        studentEmail: "jane@example.com",
        executionSuccess: true,
      })
    ).resolves.toBeUndefined();
  });
});
