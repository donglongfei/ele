// OpenClaw service (replaces EleService)
export { type ApprovalCallback, type ApprovalCallbackOptions, OpenClawService, type QueryOptions } from './OpenClawService';

// Legacy exports for backwards compatibility during migration
export { MessageChannel } from './MessageChannel';
export { OpenClawService as EleService } from './OpenClawService';
export {
  type ColdStartQueryContext,
  type PersistentQueryContext,
  QueryOptionsBuilder,
  type QueryOptionsContext,
} from './QueryOptionsBuilder';
export { SessionManager } from './SessionManager';
export type {
  ClosePersistentQueryOptions,
  PersistentQueryConfig,
  ResponseHandler,
  SessionState,
  UserContentBlock,
} from './types';
