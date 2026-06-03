export const SignalStatus = {
  ANALYZING: 'ANALYZING',
  ANALYZED: 'ANALYZED',
  DELIVERING: 'DELIVERING',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  TIMED_OUT: 'TIMED_OUT',
  EXPIRED: 'EXPIRED',
} as const;

export type SignalStatusValue = (typeof SignalStatus)[keyof typeof SignalStatus];

export const FailureReason = {
  LLM_ERROR: 'LLM_ERROR',
  TRADINGAGENTS_ERROR: 'TRADINGAGENTS_ERROR',
  TIMED_OUT: 'TIMED_OUT',
  INTERACTION_EXPIRED: 'INTERACTION_EXPIRED',
} as const;

export type FailureReasonValue = (typeof FailureReason)[keyof typeof FailureReason];
