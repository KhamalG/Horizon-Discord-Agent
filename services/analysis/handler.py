"""Placeholder handler — replaced by real analysis pipeline in story 2a-3."""
import json


def handler(event: dict, context: object) -> dict:
    print(json.dumps({"message": "placeholder handler — not yet implemented"}))
    return {"statusCode": 200, "body": "not implemented"}
