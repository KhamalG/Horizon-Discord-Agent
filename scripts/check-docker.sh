#!/usr/bin/env bash
set -euo pipefail

if ! docker info > /dev/null 2>&1; then
  echo "ERROR: Docker daemon is not running." >&2
  echo "       Please start Docker Desktop and retry." >&2
  exit 1
fi

echo "Docker is running."
