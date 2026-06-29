#!/usr/bin/env bash
# Regenerate pinned requirements.txt from pyproject.toml using uv.
# Run from repo root: bash scripts/generate-requirements.sh
set -euo pipefail
uv pip compile services/analysis/pyproject.toml -o services/analysis/requirements.txt
