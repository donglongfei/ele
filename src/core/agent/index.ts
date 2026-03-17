// OpenClaw service (replaces ClaudianService)
export { type ApprovalCallback, type ApprovalCallbackOptions, OpenClawService, type QueryOptions } from './OpenClawService';

// Legacy exports for backwards compatibility during migration
export { OpenClawService as ClaudianService } from './OpenClawService';

export { MessageChannel } from './MessageChannel';
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
