// ---------------------------------------------------------------------------
// WorkflowRegistry — Maps workflow/trigger types to handlers
// ---------------------------------------------------------------------------

import type { WorkflowType, TriggerType } from "@/lib/types/domain";
import type { WorkflowHandler } from "./types";

export class WorkflowRegistry {
  private handlers = new Map<WorkflowType, WorkflowHandler>();

  register(handler: WorkflowHandler): void {
    this.handlers.set(handler.type, handler);
  }

  getHandler(type: WorkflowType): WorkflowHandler | undefined {
    return this.handlers.get(type);
  }

  hasHandler(type: WorkflowType): boolean {
    return this.handlers.has(type);
  }

  getRegisteredTypes(): WorkflowType[] {
    return [...this.handlers.keys()];
  }
}

/**
 * Map trigger types to workflow types.
 * Returns null for manual triggers (require explicit workflow type).
 */
export function triggerToWorkflow(
  triggerType: TriggerType
): WorkflowType | null {
  switch (triggerType) {
    case "cancellation":
      return "reschedule";
    case "discovery_request":
      return "discovery_flight";
    case "lesson_complete":
      return "next_lesson";
    case "opening_detected":
      return "waitlist";
    case "manual":
      return null;
    default: {
      // Exhaustive check — will error at compile time if a new TriggerType is added
      const _exhaustive: never = triggerType;
      return _exhaustive;
    }
  }
}
