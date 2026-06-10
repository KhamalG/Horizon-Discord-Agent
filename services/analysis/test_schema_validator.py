import json
from pathlib import Path

import pytest
import jsonschema

from schema_validator import validate_signal_record

_REPO_ROOT = Path(__file__).parent.parent.parent
_FIXTURE_PATH = _REPO_ROOT / "fixtures" / "signal-record.json"


@pytest.fixture
def valid_record():
    with open(_FIXTURE_PATH) as f:
        return json.load(f)


def test_valid_fixture_passes(valid_record):
    validate_signal_record(valid_record)  # no exception


def test_missing_ticker_raises(valid_record):
    del valid_record["ticker"]
    with pytest.raises(jsonschema.ValidationError):
        validate_signal_record(valid_record)


def test_confidence_out_of_range_raises(valid_record):
    valid_record["signal"]["confidence"] = 2.0
    with pytest.raises(jsonschema.ValidationError):
        validate_signal_record(valid_record)


def test_invalid_status_raises(valid_record):
    valid_record["status"] = "PENDING"
    with pytest.raises(jsonschema.ValidationError):
        validate_signal_record(valid_record)
