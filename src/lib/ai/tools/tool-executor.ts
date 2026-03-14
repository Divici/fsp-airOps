// ---------------------------------------------------------------------------
// Tool Executor — Routes AI tool calls to scheduling tool implementations
// ---------------------------------------------------------------------------

import type { IFspClient } from "@/lib/fsp-client";
import type { AutoApprovalContext } from "../types";
import {
  checkSlotAvailability,
  getStudentHistory,
  getStudentProgress,
  getInstructorSchedule,
  getWeather,
  getOriginalContext,
} from "./scheduling-tools";

export class ToolExecutor {
  constructor(
    private fspClient: IFspClient,
    private operatorId: number,
    private context: AutoApprovalContext,
  ) {}

  async execute(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case "checkSlotAvailability":
        return checkSlotAvailability(this.fspClient, this.operatorId, {
          startTime: args.startTime as string,
          endTime: args.endTime as string,
          instructorId: args.instructorId as string | undefined,
          aircraftId: args.aircraftId as string | undefined,
          locationId: args.locationId as number,
        });

      case "getStudentHistory":
        return getStudentHistory(this.fspClient, this.operatorId, {
          studentId: args.studentId as string,
        });

      case "getStudentProgress":
        return getStudentProgress(this.fspClient, this.operatorId, {
          studentId: args.studentId as string,
        });

      case "getInstructorSchedule":
        return getInstructorSchedule(this.fspClient, this.operatorId, {
          instructorId: args.instructorId as string,
          date: args.date as string,
          locationId: args.locationId as number,
        });

      case "getWeather":
        return getWeather({
          locationId: args.locationId as number,
          date: args.date as string | undefined,
        });

      case "getOriginalContext":
        return getOriginalContext(this.context);

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }
}
