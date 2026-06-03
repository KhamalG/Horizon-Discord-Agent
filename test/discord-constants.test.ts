import { FailureReason, SignalStatus } from '../services/discord-bot/src/constants';

const EXPECTED_SIGNAL_STATUSES = [
  'ANALYZING',
  'ANALYZED',
  'DELIVERING',
  'DELIVERED',
  'FAILED',
  'TIMED_OUT',
  'EXPIRED',
] as const;

const EXPECTED_FAILURE_REASONS = [
  'LLM_ERROR',
  'TRADINGAGENTS_ERROR',
  'TIMED_OUT',
  'INTERACTION_EXPIRED',
] as const;

describe('SignalStatus constants match Python equivalents', () => {
  test('all 7 status values exist and are their own string value', () => {
    for (const status of EXPECTED_SIGNAL_STATUSES) {
      expect(SignalStatus[status]).toBe(status);
    }
  });

  test('SignalStatus has exactly the expected keys', () => {
    expect(Object.keys(SignalStatus).sort()).toEqual([...EXPECTED_SIGNAL_STATUSES].sort());
  });
});

describe('FailureReason constants match Python equivalents', () => {
  test('all 4 failure reason values exist and are their own string value', () => {
    for (const reason of EXPECTED_FAILURE_REASONS) {
      expect(FailureReason[reason]).toBe(reason);
    }
  });

  test('FailureReason has exactly the expected keys', () => {
    expect(Object.keys(FailureReason).sort()).toEqual([...EXPECTED_FAILURE_REASONS].sort());
  });
});
