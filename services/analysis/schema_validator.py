import json
from pathlib import Path

import jsonschema

_REPO_ROOT = Path(__file__).parent.parent.parent  # services/analysis/ -> repo root
_SCHEMA_PATH = _REPO_ROOT / "shared" / "signal-schema.json"

with open(_SCHEMA_PATH) as _f:
    SIGNAL_SCHEMA = json.load(_f)


def validate_signal_record(data: dict) -> None:
    """Validate a signal record dict against the shared JSON Schema.

    Raises jsonschema.ValidationError if the data does not conform to the schema.
    """
    jsonschema.validate(instance=data, schema=SIGNAL_SCHEMA)
