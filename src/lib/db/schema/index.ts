import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export {
  operatorSettings,
  operatorSettingsRelations,
} from "./operator-settings";

export {
  schedulingTriggers,
  schedulingTriggersRelations,
} from "./triggers";

export {
  proposals,
  proposalsRelations,
  proposalActions,
  proposalActionsRelations,
} from "./proposals";

export {
  approvalDecisions,
  approvalDecisionsRelations,
} from "./approvals";

export { auditEvents } from "./audit";

export {
  communicationRecords,
  communicationRecordsRelations,
} from "./communications";

export {
  prospectRequests,
  prospectRequestsRelations,
} from "./prospects";

export { scheduleSnapshots } from "./snapshots";

export { communicationOptOuts } from "./communication-opt-outs";

// Inferred types for each table
import type { operatorSettings } from "./operator-settings";
import type { scheduleSnapshots } from "./snapshots";
import type { schedulingTriggers } from "./triggers";
import type { proposals, proposalActions } from "./proposals";
import type { approvalDecisions } from "./approvals";
import type { auditEvents } from "./audit";
import type { communicationRecords } from "./communications";
import type { prospectRequests } from "./prospects";
import type { communicationOptOuts } from "./communication-opt-outs";

export type OperatorSettings = InferSelectModel<typeof operatorSettings>;
export type NewOperatorSettings = InferInsertModel<typeof operatorSettings>;

export type SchedulingTrigger = InferSelectModel<typeof schedulingTriggers>;
export type NewSchedulingTrigger = InferInsertModel<typeof schedulingTriggers>;

export type Proposal = InferSelectModel<typeof proposals>;
export type NewProposal = InferInsertModel<typeof proposals>;

export type ProposalAction = InferSelectModel<typeof proposalActions>;
export type NewProposalAction = InferInsertModel<typeof proposalActions>;

export type ApprovalDecision = InferSelectModel<typeof approvalDecisions>;
export type NewApprovalDecision = InferInsertModel<typeof approvalDecisions>;

export type AuditEvent = InferSelectModel<typeof auditEvents>;
export type NewAuditEvent = InferInsertModel<typeof auditEvents>;

export type CommunicationRecord = InferSelectModel<typeof communicationRecords>;
export type NewCommunicationRecord = InferInsertModel<typeof communicationRecords>;

export type ProspectRequest = InferSelectModel<typeof prospectRequests>;
export type NewProspectRequest = InferInsertModel<typeof prospectRequests>;

export type ScheduleSnapshot = InferSelectModel<typeof scheduleSnapshots>;
export type NewScheduleSnapshot = InferInsertModel<typeof scheduleSnapshots>;

export type CommunicationOptOut = InferSelectModel<typeof communicationOptOuts>;
export type NewCommunicationOptOut = InferInsertModel<typeof communicationOptOuts>;
