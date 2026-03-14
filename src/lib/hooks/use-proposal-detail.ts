import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ProposalDetailView } from "@/lib/types/proposal-detail";

// ---------------------------------------------------------------------------
// Mock data — replaced with real API calls in a later task
// ---------------------------------------------------------------------------

const now = new Date();

function hoursFromNow(h: number): string {
  return new Date(now.getTime() + h * 60 * 60 * 1000).toISOString();
}

function hoursAgo(h: number): string {
  return new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();
}

const mockDetails: Record<string, ProposalDetailView> = {
  "p-001": {
    id: "p-001",
    operatorId: 1,
    workflowType: "reschedule",
    status: "pending",
    priority: 8,
    summary:
      "Reschedule John Smith's cross-country lesson to tomorrow at 10 AM",
    rationale:
      "Weather at KPAO shows IFR conditions this afternoon. Tomorrow morning has clear VFR forecast with winds calm to 5 knots. Instructor Dave P. and aircraft N12345 are both available for the proposed time slot. Moving this lesson avoids a potential two-week delay due to upcoming aircraft maintenance.",
    studentNames: ["John Smith"],
    locationName: "KPAO",
    proposedStartTime: hoursFromNow(18),
    proposedEndTime: hoursFromNow(20),
    actionCount: 3,
    createdAt: hoursAgo(0.1),
    expiresAt: hoursFromNow(4),
    triggerContext: {
      type: "cancellation",
      originalReservationId: "res-4521",
      reason: "Weather — IFR conditions forecast",
      cancelledAt: hoursAgo(0.2),
    },
    actions: [
      {
        id: "a-001-1",
        rank: 1,
        actionType: "create_reservation",
        startTime: hoursFromNow(18),
        endTime: hoursFromNow(20),
        locationName: "KPAO",
        studentName: "John Smith",
        instructorName: "Dave Peterson",
        aircraftRegistration: "N12345",
        activityTypeName: "Cross-Country",
        explanation:
          "Best option: same instructor and aircraft as original booking. Morning slot has excellent VFR forecast and no conflicts.",
        validationStatus: "valid",
        executionStatus: "pending",
      },
      {
        id: "a-001-2",
        rank: 2,
        actionType: "create_reservation",
        startTime: hoursFromNow(42),
        endTime: hoursFromNow(44),
        locationName: "KPAO",
        studentName: "John Smith",
        instructorName: "Dave Peterson",
        aircraftRegistration: "N67890",
        activityTypeName: "Cross-Country",
        explanation:
          "Alternate: same instructor, different aircraft (N67890 — Cessna 172S). Two days out but still before maintenance window.",
        validationStatus: "valid",
        executionStatus: "pending",
      },
      {
        id: "a-001-3",
        rank: 3,
        actionType: "create_reservation",
        startTime: hoursFromNow(20),
        endTime: hoursFromNow(22),
        locationName: "KPAO",
        studentName: "John Smith",
        instructorName: "Mike Rodriguez",
        aircraftRegistration: "N12345",
        activityTypeName: "Cross-Country",
        explanation:
          "Alternate instructor: Mike R. is available tomorrow afternoon. Same aircraft. Slightly later start but still within VFR window.",
        validationStatus: "valid",
        executionStatus: "pending",
      },
    ],
  },
  "p-002": {
    id: "p-002",
    operatorId: 1,
    workflowType: "discovery_flight",
    status: "pending",
    priority: 6,
    summary: "Schedule discovery flight for Jane Doe — Saturday 9 AM",
    rationale:
      "New inquiry received via website form. Saturday morning slot with instructor Mike R. is open. Cessna 172 N67890 is available. Weather forecast is favorable with clear skies expected.",
    studentNames: ["Jane Doe"],
    locationName: "KPAO",
    proposedStartTime: hoursFromNow(48),
    proposedEndTime: hoursFromNow(49),
    actionCount: 1,
    createdAt: hoursAgo(0.5),
    expiresAt: hoursFromNow(24),
    triggerContext: {
      type: "discovery_request",
      prospectEmail: "jane.doe@example.com",
      submittedAt: hoursAgo(1),
    },
    actions: [
      {
        id: "a-002-1",
        rank: 1,
        actionType: "create_reservation",
        startTime: hoursFromNow(48),
        endTime: hoursFromNow(49),
        locationName: "KPAO",
        studentName: "Jane Doe",
        instructorName: "Mike Rodriguez",
        aircraftRegistration: "N67890",
        activityTypeName: "Discovery Flight",
        explanation:
          "Saturday morning is the earliest available discovery flight slot. Mike R. specializes in intro flights.",
        validationStatus: "valid",
        executionStatus: "pending",
      },
    ],
  },
  "p-003": {
    id: "p-003",
    operatorId: 1,
    workflowType: "next_lesson",
    status: "pending",
    priority: 5,
    summary: "Book next lesson for Alex Johnson — stage-check prep",
    rationale:
      "Alex completed lesson 14 yesterday. Next available slot with same instructor is Thursday at 2 PM. On track for stage check next week.",
    studentNames: ["Alex Johnson"],
    locationName: "KSQL",
    proposedStartTime: hoursFromNow(72),
    proposedEndTime: hoursFromNow(74),
    actionCount: 1,
    createdAt: hoursAgo(2),
    expiresAt: hoursFromNow(48),
    triggerContext: {
      type: "lesson_complete",
      previousLessonId: "les-1014",
      completedAt: hoursAgo(24),
    },
    trainingContext: {
      enrollmentName: "Private Pilot Certificate",
      currentStage: "Pre-Solo",
      completedLessons: 14,
      totalLessons: 20,
      nextLessonName: "Stage Check Prep",
      instructorName: "Sarah Kim",
      previousInstructorName: "Sarah Kim",
    },
    actions: [
      {
        id: "a-003-1",
        rank: 1,
        actionType: "create_reservation",
        startTime: hoursFromNow(72),
        endTime: hoursFromNow(74),
        locationName: "KSQL",
        studentName: "Alex Johnson",
        instructorName: "Sarah Kim",
        aircraftRegistration: "N54321",
        activityTypeName: "Stage Check Prep",
        explanation:
          "Maintains lesson continuity with same instructor. Thursday afternoon has no scheduling conflicts.",
        validationStatus: "valid",
        executionStatus: "pending",
      },
    ],
  },
  "p-004": {
    id: "p-004",
    operatorId: 1,
    workflowType: "next_lesson",
    status: "approved",
    priority: 5,
    summary: "Book pattern work lesson for Maria Garcia",
    rationale:
      "Continuing traffic-pattern training. Instructor Sarah K. confirmed availability Wednesday at 3 PM.",
    studentNames: ["Maria Garcia"],
    locationName: "KPAO",
    proposedStartTime: hoursFromNow(40),
    proposedEndTime: hoursFromNow(42),
    actionCount: 1,
    createdAt: hoursAgo(5),
    expiresAt: null,
    triggerContext: {
      type: "lesson_complete",
      previousLessonId: "les-987",
      completedAt: hoursAgo(48),
    },
    trainingContext: {
      enrollmentName: "Private Pilot Certificate",
      currentStage: "Solo Practice",
      completedLessons: 8,
      totalLessons: 20,
      nextLessonName: "Pattern Work",
      instructorName: "Sarah Kim",
      previousInstructorName: "Dave Peterson",
    },
    actions: [
      {
        id: "a-004-1",
        rank: 1,
        actionType: "create_reservation",
        startTime: hoursFromNow(40),
        endTime: hoursFromNow(42),
        locationName: "KPAO",
        studentName: "Maria Garcia",
        instructorName: "Sarah Kim",
        aircraftRegistration: "N67890",
        activityTypeName: "Pattern Work",
        explanation:
          "Wednesday slot keeps the student on a consistent weekly schedule.",
        validationStatus: "valid",
        executionStatus: "validated",
      },
    ],
  },
  "p-005": {
    id: "p-005",
    operatorId: 1,
    workflowType: "waitlist",
    status: "declined",
    priority: 3,
    summary: "Fill cancelled slot with waitlisted student Chris Lee",
    rationale:
      "A cancellation opened a slot at 11 AM today. Chris Lee was first on the waitlist but the operator chose a different arrangement.",
    studentNames: ["Chris Lee"],
    locationName: "KPAO",
    proposedStartTime: hoursAgo(1),
    proposedEndTime: hoursFromNow(1),
    actionCount: 1,
    createdAt: hoursAgo(3),
    expiresAt: null,
    triggerContext: {
      type: "opening_detected",
      openingSlotStart: hoursAgo(1),
      openingSlotEnd: hoursFromNow(1),
    },
    actions: [
      {
        id: "a-005-1",
        rank: 1,
        actionType: "create_reservation",
        startTime: hoursAgo(1),
        endTime: hoursFromNow(1),
        locationName: "KPAO",
        studentName: "Chris Lee",
        instructorName: "Dave Peterson",
        aircraftRegistration: "N12345",
        activityTypeName: "Ground School",
        explanation:
          "Chris Lee was first on the waitlist for this time slot.",
        validationStatus: "stale",
        executionStatus: "pending",
      },
    ],
  },
};

// Fallback for IDs not in the detailed map — builds a minimal detail from the list
async function fetchProposalDetail(
  proposalId: string
): Promise<ProposalDetailView | null> {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 300));
  return mockDetails[proposalId] ?? null;
}

// ---------------------------------------------------------------------------
// Query hook
// ---------------------------------------------------------------------------

export function useProposalDetail(proposalId: string) {
  return useQuery({
    queryKey: ["proposal", proposalId],
    queryFn: () => fetchProposalDetail(proposalId),
    enabled: !!proposalId,
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

async function approveProposal(proposalId: string): Promise<void> {
  // Simulate API call — POST /api/proposals/:id/approve
  await new Promise((r) => setTimeout(r, 600));
  // In real implementation, this would call the API
  const detail = mockDetails[proposalId];
  if (detail) {
    detail.status = "approved";
  }
}

async function declineProposal(
  proposalId: string,
  reason?: string
): Promise<void> {
  // Simulate API call — POST /api/proposals/:id/decline
  await new Promise((r) => setTimeout(r, 600));
  void reason; // will be sent to API in real implementation
  const detail = mockDetails[proposalId];
  if (detail) {
    detail.status = "declined";
  }
}

export function useApproveProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (proposalId: string) => approveProposal(proposalId),
    onSuccess: (_data, proposalId) => {
      void queryClient.invalidateQueries({
        queryKey: ["proposal", proposalId],
      });
      void queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
  });
}

export function useDeclineProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      proposalId,
      reason,
    }: {
      proposalId: string;
      reason?: string;
    }) => declineProposal(proposalId, reason),
    onSuccess: (_data, { proposalId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["proposal", proposalId],
      });
      void queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
  });
}
