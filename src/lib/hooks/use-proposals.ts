import { useQuery } from "@tanstack/react-query";
import type { ProposalFilters } from "@/lib/types/proposal-filters";
import type { ProposalView } from "@/lib/types/proposal-view";
import { isToday, isThisWeek } from "date-fns";

// ---------------------------------------------------------------------------
// Mock data — replaced with a real API call in Task 2.6
// ---------------------------------------------------------------------------

const now = new Date();

function hoursAgo(h: number): string {
  return new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();
}

function hoursFromNow(h: number): string {
  return new Date(now.getTime() + h * 60 * 60 * 1000).toISOString();
}

const mockProposals: ProposalView[] = [
  {
    id: "p-001",
    operatorId: 1,
    workflowType: "reschedule",
    status: "pending",
    priority: 8,
    summary: "Reschedule John Smith's cross-country lesson to tomorrow at 10 AM",
    rationale:
      "Weather at KPAO shows IFR conditions this afternoon. Tomorrow morning has clear VFR forecast. Instructor and aircraft N12345 are both available.",
    studentNames: ["John Smith"],
    locationName: "KPAO",
    proposedStartTime: hoursFromNow(18),
    proposedEndTime: hoursFromNow(20),
    actionCount: 2,
    createdAt: hoursAgo(0.1),
    expiresAt: hoursFromNow(4),
  },
  {
    id: "p-002",
    operatorId: 1,
    workflowType: "discovery_flight",
    status: "pending",
    priority: 6,
    summary: "Schedule discovery flight for Jane Doe — Saturday 9 AM",
    rationale:
      "New inquiry received. Saturday morning slot with instructor Mike R. is open. Cessna 172 N67890 is available.",
    studentNames: ["Jane Doe"],
    locationName: "KPAO",
    proposedStartTime: hoursFromNow(48),
    proposedEndTime: hoursFromNow(49),
    actionCount: 1,
    createdAt: hoursAgo(0.5),
    expiresAt: hoursFromNow(24),
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
    id: "p-006",
    operatorId: 1,
    workflowType: "reschedule",
    status: "expired",
    priority: 4,
    summary: "Reschedule Emily Davis due to aircraft maintenance",
    rationale:
      "N12345 entered unscheduled maintenance. Proposed moving to N67890 on the same day. Proposal expired before review.",
    studentNames: ["Emily Davis"],
    locationName: "KSQL",
    proposedStartTime: hoursAgo(24),
    proposedEndTime: hoursAgo(22),
    actionCount: 2,
    createdAt: hoursAgo(30),
    expiresAt: hoursAgo(6),
  },
  {
    id: "p-007",
    operatorId: 1,
    workflowType: "reschedule",
    status: "executed",
    priority: 7,
    summary: "Reschedule Tom Wilson's lesson after instructor sick call",
    rationale:
      "Instructor Dave P. called in sick. Reassigned to instructor Mike R. at same time on same aircraft.",
    studentNames: ["Tom Wilson"],
    locationName: "KPAO",
    proposedStartTime: hoursAgo(10),
    proposedEndTime: hoursAgo(8),
    actionCount: 2,
    createdAt: hoursAgo(14),
    expiresAt: null,
  },
  {
    id: "p-008",
    operatorId: 1,
    workflowType: "discovery_flight",
    status: "pending",
    priority: 6,
    summary: "Schedule discovery flight for Sam Brown — Friday 2 PM",
    rationale:
      "Website inquiry received yesterday. Friday afternoon slot available with instructor Sarah K. Weather looks favorable.",
    studentNames: ["Sam Brown"],
    locationName: "KPAO",
    proposedStartTime: hoursFromNow(24),
    proposedEndTime: hoursFromNow(25),
    actionCount: 1,
    createdAt: hoursAgo(1),
    expiresAt: hoursFromNow(12),
  },
];

// ---------------------------------------------------------------------------
// Fetch function (mock for now)
// ---------------------------------------------------------------------------

async function fetchProposals(
  filters: ProposalFilters
): Promise<ProposalView[]> {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 400));

  return mockProposals.filter((p) => {
    if (filters.status !== "all" && p.status !== filters.status) return false;
    if (filters.workflowType !== "all" && p.workflowType !== filters.workflowType)
      return false;

    if (filters.dateRange === "today") {
      if (!isToday(new Date(p.createdAt))) return false;
    } else if (filters.dateRange === "week") {
      if (!isThisWeek(new Date(p.createdAt))) return false;
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProposals(filters: ProposalFilters) {
  return useQuery({
    queryKey: ["proposals", filters],
    queryFn: () => fetchProposals(filters),
  });
}
