import { useQuery } from "@tanstack/react-query";
import type {
  DashboardMetrics,
  RecentActivityItem,
} from "@/lib/types/dashboard-metrics";

// ---------------------------------------------------------------------------
// Mock data — replaced with real API calls in a later phase
// ---------------------------------------------------------------------------

const mockMetrics: DashboardMetrics = {
  pendingProposals: 4,
  approvedToday: 3,
  declinedToday: 1,
  executedToday: 2,
  activeWorkflows: 1,
  recentActivity: 12,
};

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

const mockActivity: RecentActivityItem[] = [
  {
    id: "ae-1",
    eventType: "proposal_generated",
    entityType: "proposal",
    summary: "New reschedule proposal for John Smith",
    timestamp: hoursAgo(0.1),
    operatorId: 1,
  },
  {
    id: "ae-2",
    eventType: "proposal_approved",
    entityType: "proposal",
    summary: "Discovery flight for Jane Doe approved",
    timestamp: hoursAgo(0.5),
    operatorId: 1,
  },
  {
    id: "ae-3",
    eventType: "reservation_created",
    entityType: "proposal_action",
    summary: "Reservation created for Tom Wilson's lesson",
    timestamp: hoursAgo(1),
    operatorId: 1,
  },
  {
    id: "ae-4",
    eventType: "proposal_declined",
    entityType: "proposal",
    summary: "Waitlist proposal for Chris Lee declined",
    timestamp: hoursAgo(2),
    operatorId: 1,
  },
  {
    id: "ae-5",
    eventType: "trigger_received",
    entityType: "trigger",
    summary: "Cancellation detected for reservation #4521",
    timestamp: hoursAgo(3),
    operatorId: 1,
  },
];

// ---------------------------------------------------------------------------
// Fetch functions (mock for now)
// ---------------------------------------------------------------------------

async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  await new Promise((r) => setTimeout(r, 300));
  return mockMetrics;
}

async function fetchRecentActivity(): Promise<RecentActivityItem[]> {
  await new Promise((r) => setTimeout(r, 200));
  return mockActivity;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: fetchDashboardMetrics,
    refetchInterval: 30_000,
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ["recent-activity"],
    queryFn: fetchRecentActivity,
    refetchInterval: 30_000,
  });
}
