import json
from pathlib import Path

import jsonschema

# Local dev: schema is 3 levels up at repo root/shared/signal-schema.json
# Lambda bundle: CDK PythonFunction copies shared/signal-schema.json alongside this file
_LOCAL_SCHEMA = Path(__file__).parent.parent.parent / "shared" / "signal-schema.json"
_BUNDLE_SCHEMA = Path(__file__).parent / "signal-schema.json"
_SCHEMA_PATH = _LOCAL_SCHEMA if _LOCAL_SCHEMA.exists() else _BUNDLE_SCHEMA

with open(_SCHEMA_PATH) as _f:
    SIGNAL_SCHEMA = json.load(_f)

_FORMAT_CHECKER = jsonschema.FormatChecker()


def validate_signal_record(data: dict) -> None:
    """Validate a signal record dict against the shared JSON Schema.

    Raises jsonschema.ValidationError if the data does not conform to the schema.
    """
    jsonschema.validate(instance=data, schema=SIGNAL_SCHEMA, format_checker=_FORMAT_CHECKER)
