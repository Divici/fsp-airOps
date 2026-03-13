// ---------------------------------------------------------------------------
// API Request / Response Zod Schemas
// Validates inbound requests at the edge before hitting business logic.
// ---------------------------------------------------------------------------

import { z } from "zod";

// ---- Discovery flight intake form -----------------------------------------

export const createProspectRequestSchema = z.object({
  operatorId: z.number().int().positive(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  preferredLocationId: z.number().int().positive().optional(),
  preferredDateStart: z.string().date().optional(),
  preferredDateEnd: z.string().date().optional(),
  preferredTimeWindows: z
    .array(z.object({ start: z.string(), end: z.string() }))
    .optional(),
  notes: z.string().optional(),
});

export type CreateProspectRequest = z.infer<
  typeof createProspectRequestSchema
>;

// ---- Proposal approval ----------------------------------------------------

export const approveProposalSchema = z.object({
  proposalId: z.string().uuid(),
  decidedByUserId: z.string().min(1),
  notes: z.string().optional(),
});

export type ApproveProposalRequest = z.infer<typeof approveProposalSchema>;

// ---- Proposal decline -----------------------------------------------------

export const declineProposalSchema = z.object({
  proposalId: z.string().uuid(),
  decidedByUserId: z.string().min(1),
  reason: z.string().optional(),
});

export type DeclineProposalRequest = z.infer<typeof declineProposalSchema>;

// ---- Operator settings update ---------------------------------------------

export const updateOperatorSettingsSchema = z.object({
  timeSinceLastFlightWeight: z.number().min(0).max(10).optional(),
  timeUntilNextFlightWeight: z.number().min(0).max(10).optional(),
  totalFlightHoursWeight: z.number().min(0).max(10).optional(),
  preferSameInstructor: z.boolean().optional(),
  preferSameInstructorWeight: z.number().min(0).max(10).optional(),
  preferSameAircraft: z.boolean().optional(),
  preferSameAircraftWeight: z.number().min(0).max(10).optional(),
  searchWindowDays: z.number().int().min(1).max(30).optional(),
  topNAlternatives: z.number().int().min(1).max(20).optional(),
  daylightOnly: z.boolean().optional(),
  enabledWorkflows: z
    .object({
      reschedule: z.boolean().optional(),
      discovery_flight: z.boolean().optional(),
      next_lesson: z.boolean().optional(),
      waitlist: z.boolean().optional(),
    })
    .optional(),
  communicationPreferences: z
    .object({
      email: z.boolean().optional(),
      sms: z.boolean().optional(),
    })
    .optional(),
});

export type UpdateOperatorSettingsRequest = z.infer<
  typeof updateOperatorSettingsSchema
>;

// ---- Proposal list query --------------------------------------------------

export const proposalListQuerySchema = z.object({
  status: z
    .enum([
      "draft",
      "pending",
      "approved",
      "declined",
      "expired",
      "executed",
      "failed",
    ])
    .optional(),
  workflowType: z
    .enum(["reschedule", "discovery_flight", "next_lesson", "waitlist"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ProposalListQuery = z.infer<typeof proposalListQuerySchema>;

// ---- Cancellation trigger -------------------------------------------------

export const triggerCancellationSchema = z.object({
  operatorId: z.number().int().positive(),
  cancelledReservationId: z.string().min(1),
  cancelledStudentId: z.string().min(1),
  cancelledInstructorId: z.string().optional(),
  cancelledAircraftId: z.string().optional(),
  originalStart: z.string().datetime(),
  originalEnd: z.string().datetime(),
  locationId: z.number().int().positive(),
});

export type TriggerCancellationRequest = z.infer<
  typeof triggerCancellationSchema
>;
