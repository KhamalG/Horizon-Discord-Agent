class SignalStatus:
    ANALYZING = 'ANALYZING'
    ANALYZED = 'ANALYZED'
    DELIVERING = 'DELIVERING'
    DELIVERED = 'DELIVERED'
    FAILED = 'FAILED'
    TIMED_OUT = 'TIMED_OUT'
    EXPIRED = 'EXPIRED'


# Unknown status values must be handled by logging a warning and continuing,
# never by raising — per Architecture §N-3. Future status additions must not
# break existing Lambdas.
class FailureReason:
    LLM_ERROR = 'LLM_ERROR'
    TRADINGAGENTS_ERROR = 'TRADINGAGENTS_ERROR'
    TIMED_OUT = 'TIMED_OUT'
    INTERACTION_EXPIRED = 'INTERACTION_EXPIRED'
