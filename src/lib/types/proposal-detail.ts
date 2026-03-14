import type { ProposalView } from "./proposal-view";
import type { ValidationStatus, ExecutionStatus } from "./domain";

/**
 * A single proposed action within a proposal.
 * Each action represents one scheduling operation the AI suggests.
 */
export interface ProposalActionView {
  id: string;
  rank: number;
  actionType: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  locationName: string;
  studentName: string;
  instructorName?: string;
  aircraftRegistration?: string;
  activityTypeName?: string;
  explanation?: string;
  validationStatus: ValidationStatus;
  executionStatus: ExecutionStatus;
}

/**
 * Training progression metadata populated by the next_lesson workflow.
 */
export interface TrainingContextData {
  enrollmentName?: string;
  currentStage?: string;
  completedLessons?: number;
  totalLessons?: number;
  nextLessonName?: string;
  instructorName?: string;
  previousInstructorName?: string;
}

/**
 * Extended proposal view with full detail data including
 * actions list and trigger context for the detail page.
 */
export interface ProposalDetailView extends ProposalView {
  actions: ProposalActionView[];
  triggerContext?: Record<string, unknown>;
  trainingContext?: TrainingContextData;
}
