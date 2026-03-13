import type { ProposalStatus, WorkflowType } from "./domain";

export type DateRange = "today" | "week" | "all";

export interface ProposalFilters {
  status: ProposalStatus | "all";
  workflowType: WorkflowType | "all";
  dateRange: DateRange;
}

export const defaultFilters: ProposalFilters = {
  status: "pending",
  workflowType: "all",
  dateRange: "all",
};

export const allStatusFilters: ProposalFilters = {
  status: "all",
  workflowType: "all",
  dateRange: "all",
};
