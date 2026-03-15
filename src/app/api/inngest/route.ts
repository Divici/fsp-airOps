import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { processTrigger } from "@/inngest/functions/process-trigger";
import {
  evaluateScheduleCron,
  evaluateOperatorSchedule,
} from "@/inngest/functions/evaluate-schedule";
import { expireProposalsCron } from "@/inngest/functions/expire-proposals";
import { evaluateAutoApproval } from "@/inngest/functions/evaluate-auto-approval";
import {
  detectInactivityCron,
  evaluateOperatorInactivity,
} from "@/inngest/functions/detect-inactivity";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processTrigger,
    evaluateScheduleCron,
    evaluateOperatorSchedule,
    expireProposalsCron,
    evaluateAutoApproval,
    detectInactivityCron,
    evaluateOperatorInactivity,
  ],
});
