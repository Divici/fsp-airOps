// ---------------------------------------------------------------------------
// Communications Module — Public API
// ---------------------------------------------------------------------------

export { CommunicationService } from "./communication-service";
export type { SendParams, HistoryFilters } from "./communication-service";
export { FspEmailProvider } from "./email-provider";
export { SmsProvider } from "./sms-provider";
export {
  renderTemplate,
  getTemplate,
  getTemplateForOperator,
  getDefaultTemplates,
  extractTemplateVariables,
  listTemplateIds,
} from "./templates";
export type { MessageTemplate, OperatorTemplateOverrides } from "./templates";
export type {
  CommunicationChannel,
  CommunicationProvider,
  SendMessageRequest,
  SendMessageResult,
} from "./types";
