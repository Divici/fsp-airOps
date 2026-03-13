// ---------------------------------------------------------------------------
// FindATimeAdapter — Wraps the FSP Find-a-Time API for workflow use
// ---------------------------------------------------------------------------

import type { IFspClient } from "@/lib/fsp-client";
import type { SlotOption } from "@/lib/types/workflow";

export interface FindSlotsParams {
  operatorId: number;
  activityTypeId: string;
  instructorIds?: string[];
  aircraftIds?: string[];
  schedulingGroupIds?: string[];
  customerId?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  duration: number; // minutes
}

export class FindATimeAdapter {
  constructor(private fspClient: IFspClient) {}

  async findSlots(params: FindSlotsParams): Promise<SlotOption[]> {
    const slots = await this.fspClient.findATime(params.operatorId, {
      activityTypeId: params.activityTypeId,
      instructorIds: params.instructorIds,
      aircraftIds: params.aircraftIds,
      schedulingGroupIds: params.schedulingGroupIds,
      customerId: params.customerId,
      startDate: params.startDate,
      endDate: params.endDate,
      duration: params.duration,
    });

    return slots;
  }
}
