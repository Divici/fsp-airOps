// ---------------------------------------------------------------------------
// Inngest Event Types — Typed events for async workflow execution
// ---------------------------------------------------------------------------

export type Events = {
  "scheduler/trigger.received": {
    data: {
      triggerId: string;
      operatorId: number;
      triggerType: string;
    };
  };
  "scheduler/schedule.evaluate": {
    data: {
      operatorId: number;
      workflowType?: string;
      context?: Record<string, unknown>;
    };
  };
};
