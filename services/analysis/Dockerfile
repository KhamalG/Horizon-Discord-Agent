# Production Lambda container image for the Horizon analysis service.
# Build context: repo root (required so COPY can reach services/analysis/).
#
# Build (from repo root):
#   docker build -t horizon-analysis:local -f services/analysis/Dockerfile .
#
# Story 2a-3 replaces handler.py with the real analysis pipeline.

FROM public.ecr.aws/lambda/python:3.13

# Install production dependencies from pinned requirements.txt.
# TradingAgents and its transitive deps are installed from PyPI.
# Dev-only tools (pytest, ruff) are NOT installed here.
COPY services/analysis/requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install -r ${LAMBDA_TASK_ROOT}/requirements.txt --no-cache-dir

# Copy analysis service source to the Lambda task root.
COPY services/analysis/ ${LAMBDA_TASK_ROOT}/

CMD ["handler.handler"]
