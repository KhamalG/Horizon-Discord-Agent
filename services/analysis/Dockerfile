# Production Lambda container image for the Horizon analysis service.
# Build context: repo root (required so COPY can reach services/analysis/).
#
# Build (from repo root):
#   docker build -t horizon-analysis:local -f services/analysis/Dockerfile .
#
# Story 2a-3 replaces handler.py with the real analysis pipeline.

FROM public.ecr.aws/lambda/python:3.13

# Build context: services/analysis/ (CDK fromImageAsset uses that directory).
# Dev-only tools (pytest, ruff) are NOT installed here.
COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install -r ${LAMBDA_TASK_ROOT}/requirements.txt --no-cache-dir

COPY . ${LAMBDA_TASK_ROOT}/

CMD ["handler.handler"]
