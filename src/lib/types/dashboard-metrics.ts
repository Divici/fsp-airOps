// ---------------------------------------------------------------------------
// Dashboard Metrics — Types for the dashboard overview widget
// ---------------------------------------------------------------------------

export interface DashboardMetrics {
  pendingProposals: number;
  approvedToday: number;
  declinedToday: number;
  executedToday: number;
  activeWorkflows: number;
  recentActivity: number;
  autoApprovedToday: number;
}

export interface RecentActivityItem {
  id: string;
  eventType: string;
  entityType: string;
  summary: string;
  timestamp: string;
  operatorId: number;
}
