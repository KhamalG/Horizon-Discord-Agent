from constants import FailureReason, SignalStatus


def test_signal_status_values_are_strings():
    statuses = [
        'ANALYZING', 'ANALYZED', 'DELIVERING', 'DELIVERED', 'FAILED', 'TIMED_OUT', 'EXPIRED'
    ]
    for attr in statuses:
        value = getattr(SignalStatus, attr)
        assert isinstance(value, str), f'SignalStatus.{attr} must be a string'
        assert value == attr, f'SignalStatus.{attr} expected "{attr}", got "{value}"'


def test_failure_reason_values_are_strings():
    for attr in ['LLM_ERROR', 'TRADINGAGENTS_ERROR', 'TIMED_OUT', 'INTERACTION_EXPIRED']:
        value = getattr(FailureReason, attr)
        assert isinstance(value, str), f'FailureReason.{attr} must be a string'
        assert value == attr, f'FailureReason.{attr} expected "{attr}", got "{value}"'
