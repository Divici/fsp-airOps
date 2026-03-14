// ---------------------------------------------------------------------------
// Proposal Mapper — Converts DB rows to ProposalView / ProposalDetailView
// ---------------------------------------------------------------------------

import type { ProposalWithActions } from "@/lib/db/queries/proposals";
import type { ProposalAction } from "@/lib/db/schema";
import type { IFspClient } from "@/lib/fsp-client";
import type { ProposalView } from "@/lib/types/proposal-view";
import type {
  ProposalDetailView,
  ProposalActionView,
} from "@/lib/types/proposal-detail";

// ---------------------------------------------------------------------------
// Internal helpers — cached FSP resource lookups
// ---------------------------------------------------------------------------

interface FspLookups {
  locationName: (id: number) => string;
  userName: (id: string) => string;
  aircraftRegistration: (id: string) => string;
  activityTypeName: (id: string) => string;
}

async function buildLookups(
  fspClient: IFspClient,
  operatorId: number
): Promise<FspLookups> {
  const [locations, users, aircraft, activityTypes] = await Promise.all([
    fspClient.getLocations(operatorId),
    fspClient.getUsers(operatorId),
    fspClient.getAircraft(operatorId),
    fspClient.getActivityTypes(operatorId),
  ]);

  const locationMap = new Map(locations.map((l) => [Number(l.id), l.name]));
  const userMap = new Map(users.map((u) => [u.id, u.fullName]));
  const aircraftMap = new Map(aircraft.map((a) => [a.id, a.registration]));
  const activityMap = new Map(activityTypes.map((a) => [a.id, a.name]));

  return {
    locationName: (id) => locationMap.get(id) ?? `Location ${id}`,
    userName: (id) => userMap.get(id) ?? `User ${id}`,
    aircraftRegistration: (id) => aircraftMap.get(id) ?? `Aircraft ${id}`,
    activityTypeName: (id) => activityMap.get(id) ?? `Activity ${id}`,
  };
}

// ---------------------------------------------------------------------------
// Action mapping
// ---------------------------------------------------------------------------

function mapAction(
  action: ProposalAction,
  lookups: FspLookups
): ProposalActionView {
  return {
    id: action.id,
    rank: action.rank,
    actionType: action.actionType,
    startTime: action.startTime.toISOString(),
    endTime: action.endTime.toISOString(),
    locationName: lookups.locationName(action.locationId),
    studentName: lookups.userName(action.studentId),
    instructorName: action.instructorId
      ? lookups.userName(action.instructorId)
      : undefined,
    aircraftRegistration: action.aircraftId
      ? lookups.aircraftRegistration(action.aircraftId)
      : undefined,
    activityTypeName: action.activityTypeId
      ? lookups.activityTypeName(action.activityTypeId)
      : undefined,
    explanation: action.explanation ?? undefined,
    validationStatus: action.validationStatus!,
    executionStatus: action.executionStatus!,
  };
}

// ---------------------------------------------------------------------------
// Proposal list mapping (ProposalView[])
// ---------------------------------------------------------------------------

function toProposalView(
  proposal: ProposalWithActions,
  lookups: FspLookups
): ProposalView {
  const actions = proposal.actions;
  const firstAction = actions[0];

  // Collect unique student names from actions
  const studentNames = [
    ...new Set(actions.map((a) => lookups.userName(a.studentId))),
  ];

  return {
    id: proposal.id,
    operatorId: proposal.operatorId,
    workflowType: proposal.workflowType!,
    status: proposal.status!,
    priority: proposal.priority,
    summary: proposal.summary,
    rationale: proposal.rationale,
    studentNames,
    locationName: firstAction
      ? lookups.locationName(firstAction.locationId)
      : "Unknown",
    proposedStartTime: firstAction
      ? firstAction.startTime.toISOString()
      : new Date().toISOString(),
    proposedEndTime: firstAction
      ? firstAction.endTime.toISOString()
      : new Date().toISOString(),
    actionCount: actions.length,
    createdAt: proposal.createdAt.toISOString(),
    expiresAt: proposal.expiresAt?.toISOString() ?? null,
  };
}

/**
 * Map a list of proposals (with actions attached) to ProposalView[].
 * Fetches FSP resource names for denormalization.
 */
export async function mapProposals(
  proposals: ProposalWithActions[],
  fspClient: IFspClient,
  operatorId: number
): Promise<ProposalView[]> {
  if (proposals.length === 0) return [];

  const lookups = await buildLookups(fspClient, operatorId);
  return proposals.map((p) => toProposalView(p, lookups));
}

// ---------------------------------------------------------------------------
// Proposal detail mapping (ProposalDetailView)
// ---------------------------------------------------------------------------

/**
 * Map a single proposal with actions to a ProposalDetailView.
 * Fetches FSP resource names for denormalization.
 */
export async function mapProposalDetail(
  proposal: ProposalWithActions,
  fspClient: IFspClient,
  operatorId: number
): Promise<ProposalDetailView> {
  const lookups = await buildLookups(fspClient, operatorId);
  const base = toProposalView(proposal, lookups);

  return {
    ...base,
    actions: proposal.actions.map((a) => mapAction(a, lookups)),
    triggerContext: undefined,
    trainingContext: undefined,
  };
}
