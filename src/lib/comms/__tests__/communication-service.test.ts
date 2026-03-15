import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CommunicationService } from "../communication-service";
import { FspEmailProvider } from "../email-provider";
import { SmsProvider } from "../sms-provider";
import { getTemplate, renderTemplate } from "../templates";
import type { CommunicationProvider } from "../types";

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------

function createMockDb() {
  const insertedRows: Record<string, unknown>[] = [];
  const updatedRows: { id: string; data: Record<string, unknown> }[] = [];

  return {
    insertedRows,
    updatedRows,
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation(() => {
          const row = {
            id: `rec-${insertedRows.length + 1}`,
            ...insertedRows[insertedRows.length],
            createdAt: new Date(),
          };
          insertedRows.push(row);
          return Promise.resolve([row]);
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          return Promise.resolve();
        }),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CommunicationService", () => {
  let db: ReturnType<typeof createMockDb>;
  let service: CommunicationService;

  beforeEach(() => {
    db = createMockDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new CommunicationService(db as any);
  });

  it("sends via email provider and records in DB", async () => {
    const emailProvider = new FspEmailProvider();
    service.registerProvider(emailProvider);

    const result = await service.send({
      operatorId: 1,
      channel: "email",
      recipientId: "student-001",
      to: "student@example.com",
      subject: "Your lesson is confirmed",
      body: "See you tomorrow!",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    // DB insert should have been called
    expect(db.insert).toHaveBeenCalled();
    // DB update should have been called to mark as sent
    expect(db.update).toHaveBeenCalled();
  });

  it("sends via SMS provider and records in DB", async () => {
    const smsProvider = new SmsProvider();
    service.registerProvider(smsProvider);

    const result = await service.send({
      operatorId: 1,
      channel: "sms",
      recipientId: "student-002",
      to: "+1-555-0123",
      body: "Your lesson is confirmed for tomorrow at 10 AM.",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(db.insert).toHaveBeenCalled();
  });

  it("returns failure when no provider is registered for channel", async () => {
    const result = await service.send({
      operatorId: 1,
      channel: "sms",
      recipientId: "student-001",
      to: "+1-555-0123",
      body: "Test",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("No provider registered");
  });

  it("handles provider send failure gracefully", async () => {
    const failProvider: CommunicationProvider = {
      channel: "email",
      send: vi.fn().mockRejectedValue(new Error("SMTP connection refused")),
    };
    service.registerProvider(failProvider);

    const result = await service.send({
      operatorId: 1,
      channel: "email",
      recipientId: "student-001",
      to: "student@example.com",
      subject: "Test",
      body: "Test body",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("SMTP connection refused");
    // Update record should mark as failed
    expect(db.update).toHaveBeenCalled();
  });

  it("queries communication history", async () => {
    const emailProvider = new FspEmailProvider();
    service.registerProvider(emailProvider);

    const history = await service.getHistory(1, { channel: "email" });

    expect(Array.isArray(history)).toBe(true);
    expect(db.select).toHaveBeenCalled();
  });
});

describe("Templates", () => {
  it("renders proposal_ready template with variables", () => {
    const template = getTemplate("proposal_ready");
    expect(template).toBeDefined();

    const rendered = renderTemplate(template!, {
      dispatcherName: "Jane",
      workflowType: "reschedule",
      studentName: "John Smith",
      summary: "Move lesson to Thursday",
    });

    expect(rendered.subject).toBe(
      "New scheduling proposal ready for review"
    );
    expect(rendered.body).toContain("Hi Jane");
    expect(rendered.body).toContain("reschedule");
    expect(rendered.body).toContain("John Smith");
  });

  it("renders discovery_flight_confirmation template", () => {
    const template = getTemplate("discovery_flight_confirmation");
    expect(template).toBeDefined();

    const rendered = renderTemplate(template!, {
      prospectName: "Sam",
      date: "March 15, 2026",
      time: "2:00 PM",
      location: "KPAO",
      instructorName: "Mike R.",
      contactPhone: "555-1234",
      operatorName: "Bay Area Flight School",
    });

    expect(rendered.body).toContain("Hi Sam");
    expect(rendered.body).toContain("March 15, 2026");
    expect(rendered.body).toContain("Mike R.");
  });

  it("leaves unknown variables as-is", () => {
    const template = getTemplate("proposal_ready");
    const rendered = renderTemplate(template!, {
      dispatcherName: "Jane",
    });

    // Variables not provided should remain as {{variable}}
    expect(rendered.body).toContain("{{workflowType}}");
    expect(rendered.body).toContain("{{studentName}}");
  });
});

describe("FspEmailProvider", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("falls back to stub when SENDGRID_API_KEY is missing", async () => {
    delete process.env.SENDGRID_API_KEY;
    delete process.env.SENDGRID_FROM_EMAIL;

    const provider = new FspEmailProvider();
    const result = await provider.send({
      channel: "email",
      to: "test@example.com",
      subject: "Test",
      body: "Hello",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^email-stub-/);
  });

  it("falls back to stub when only API key is set but FROM is missing", async () => {
    process.env.SENDGRID_API_KEY = "SG.test";
    delete process.env.SENDGRID_FROM_EMAIL;

    const provider = new FspEmailProvider();
    const result = await provider.send({
      channel: "email",
      to: "test@example.com",
      body: "Hello",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^email-stub-/);
  });
});

describe("SmsProvider", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("falls back to stub when Twilio credentials are missing", async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;

    const provider = new SmsProvider();
    const result = await provider.send({
      channel: "sms",
      to: "+15551234567",
      body: "Test message",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^sms-stub-/);
  });

  it("falls back to stub when only partial credentials are set", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;

    const provider = new SmsProvider();
    const result = await provider.send({
      channel: "sms",
      to: "+15551234567",
      body: "Test message",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^sms-stub-/);
  });
});
