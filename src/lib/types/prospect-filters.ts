import type { ProspectStatus } from "./domain";

export interface ProspectFilters {
  status: ProspectStatus | "all";
}

export const defaultProspectFilters: ProspectFilters = {
  status: "all",
};
