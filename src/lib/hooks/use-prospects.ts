import { useQuery } from "@tanstack/react-query";
import type { ProspectView } from "@/lib/types/prospect-view";
import type { ProspectFilters } from "@/lib/types/prospect-filters";

// ---------------------------------------------------------------------------
// Mock data — replaced with a real API call in a later task
// ---------------------------------------------------------------------------

const now = new Date();

function hoursAgo(h: number): string {
  return new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();
}

function daysFromNow(d: number): string {
  return new Date(now.getTime() + d * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
}

const mockProspects: ProspectView[] = [
  {
    id: "pr-001",
    operatorId: 1,
    firstName: "Jane",
    lastName: "Doe",
    email: "jane.doe@example.com",
    phone: "(555) 123-4567",
    status: "new",
    preferredDate: daysFromNow(3),
    preferredTimeOfDay: "morning",
    createdAt: hoursAgo(1),
    linkedProposalId: null,
  },
  {
    id: "pr-002",
    operatorId: 1,
    firstName: "Sam",
    lastName: "Brown",
    email: "sam.brown@example.com",
    phone: "(555) 987-6543",
    status: "processing",
    preferredDate: daysFromNow(5),
    preferredTimeOfDay: "afternoon",
    createdAt: hoursAgo(4),
    linkedProposalId: null,
  },
  {
    id: "pr-003",
    operatorId: 1,
    firstName: "Rachel",
    lastName: "Kim",
    email: "rachel.kim@example.com",
    phone: null,
    status: "proposed",
    preferredDate: daysFromNow(2),
    preferredTimeOfDay: "morning",
    createdAt: hoursAgo(12),
    linkedProposalId: "p-002",
  },
  {
    id: "pr-004",
    operatorId: 1,
    firstName: "David",
    lastName: "Chen",
    email: "david.chen@example.com",
    phone: "(555) 456-7890",
    status: "booked",
    preferredDate: daysFromNow(1),
    preferredTimeOfDay: "evening",
    createdAt: hoursAgo(48),
    linkedProposalId: "p-008",
  },
  {
    id: "pr-005",
    operatorId: 1,
    firstName: "Lisa",
    lastName: "Park",
    email: "lisa.park@example.com",
    phone: "(555) 222-3344",
    status: "new",
    preferredDate: daysFromNow(7),
    preferredTimeOfDay: "afternoon",
    createdAt: hoursAgo(0.5),
    linkedProposalId: null,
  },
  {
    id: "pr-006",
    operatorId: 1,
    firstName: "Marcus",
    lastName: "Johnson",
    email: "marcus.j@example.com",
    phone: "(555) 111-2233",
    status: "cancelled",
    preferredDate: null,
    preferredTimeOfDay: null,
    createdAt: hoursAgo(72),
    linkedProposalId: null,
  },
];

// ---------------------------------------------------------------------------
// Fetch function (mock for now)
// ---------------------------------------------------------------------------

async function fetchProspects(
  filters: ProspectFilters
): Promise<ProspectView[]> {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 400));

  return mockProspects.filter((p) => {
    if (filters.status !== "all" && p.status !== filters.status) return false;
    return true;
  });
}

async function fetchProspectDetail(
  id: string
): Promise<ProspectView | null> {
  await new Promise((r) => setTimeout(r, 300));
  return mockProspects.find((p) => p.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useProspects(filters: ProspectFilters) {
  return useQuery({
    queryKey: ["prospects", filters],
    queryFn: () => fetchProspects(filters),
  });
}

export function useProspectDetail(id: string) {
  return useQuery({
    queryKey: ["prospect", id],
    queryFn: () => fetchProspectDetail(id),
    enabled: !!id,
  });
}
