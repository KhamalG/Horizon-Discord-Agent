# Horizon Discord Agent — Developer Guide

This file is automatically loaded by Claude Code when you work in this directory. Read it before touching any Lambda code.

Horizon is a Discord trading signal bot backed by two AWS Lambda runtimes: a **Python Lambda** (TradingAgents analysis) and a **TypeScript Lambda** (Discord delivery + card formatting). They share a single DynamoDB signals table and communicate exclusively via DynamoDB Streams. The CDK app (`lib/`) provisions both in two stacks — `HorizonDevStack` (dev Discord server) and `HorizonProdStack` (live community).

---

## Project Overview

**Two Lambda runtimes, one DynamoDB stream:**

- **Python Lambda** (`services/analysis/handler.py`) — receives SQS messages (cron or on-demand), runs `ta.propagate(ticker, date)` via TradingAgents, writes the result to DynamoDB. TradingAgents is a Python-only library; it cannot run in the TypeScript Lambda.
- **TypeScript Lambda** (`services/discord-bot/src/handler.ts`) — receives two event sources: API Gateway HTTP (Discord interactions) and DynamoDB Streams (signal completion). Both are handled by one Lambda entry point.

**Two DynamoDB tables:**

| Table | Purpose |
|-------|---------|
| `{env}-horizon-signals` | Signal records — status lifecycle, analysis results, cost tracking |
| `{env}-horizon-config` | Lucan persona prompts (versioned), CONFIG#GLOBAL watchlist/rate limits, LLM pricing |

**Two CDK stacks:**

| Stack | Target |
|-------|--------|
| `HorizonDevStack` | Dev Discord test server; `/horizon/${envName}/` Secrets Manager paths |
| `HorizonProdStack` | Live community; manual approval required before deploy |

---

## Critical Patterns

### Two-Event-Source TypeScript Lambda

The TypeScript Lambda intentionally handles two unrelated event shapes in a single handler. This was a deliberate trade-off — one Lambda with two triggers instead of two separate Lambdas — to keep the deployment surface small.

The handler must distinguish which event it received and route accordingly:

```typescript
// Event 1: DynamoDB Streams record
// { Records: [{ eventName: 'MODIFY', dynamodb: { NewImage, OldImage }, ... }] }

// Event 2: API Gateway HTTP request (Discord interaction)
// { version: '2.0', requestContext: { http: { method: 'POST' } }, headers: { 'x-signature-ed25519': ... }, body: '...' }

export const handler = async (event: DynamoDBStreamEvent | APIGatewayProxyEventV2) => {
  if ('Records' in event) {
    return await handleStreams(event as DynamoDBStreamEvent);
  }
  return await handleInteraction(event as APIGatewayProxyEventV2);
};
```

The presence of `Records` distinguishes a Streams event from an API Gateway event. Never use a single catch-all handler that ignores the routing.

---

### DynamoDB Streams MODIFY Guard

The Streams handler MUST guard on `eventName === 'MODIFY'`, not `'INSERT'`. Getting this wrong ships a silent bug — the Lambda fires on INSERT (when Python writes the initial `ANALYZING` record) before any analysis has run, producing an empty or half-formed card.

The correct guard also checks the state transition:

```typescript
for (const record of event.Records) {
  if (record.eventName !== 'MODIFY') continue;  // ignore INSERT and REMOVE

  const old = unmarshall(record.dynamodb!.OldImage!);
  const next = unmarshall(record.dynamodb!.NewImage!);

  if (old.status !== 'ANALYZING') continue;  // only act on ANALYZING → terminal transitions
  if (!['ANALYZED', 'FAILED', 'TIMED_OUT'].includes(next.status)) continue;

  // safe to proceed: analysis is complete or definitively failed
}
```

Why? The flow is:
1. Python Lambda writes `status=ANALYZING` (INSERT event — **ignore this**)
2. Python Lambda updates to `status=ANALYZED` (MODIFY event — **act on this**)

The MODIFY guard with the state-transition check ensures card delivery fires exactly once, on the right state.

---

### Discord Deferred Response (type 5)

Discord's interaction timeout is 3 seconds. The `/analyze` command triggers TradingAgents analysis which takes 10–90 seconds. The interaction handler must return `{ type: 5 }` immediately — this tells Discord "acknowledged, thinking" — and deliver the actual card asynchronously via the DynamoDB Streams path.

Forgetting `type: 5` causes every `/analyze` command to show "This application did not respond".

```typescript
// services/discord-bot/src/interactionHandler.ts (Epic 3)
if (interaction.type === InteractionType.APPLICATION_COMMAND) {
  // 1. Validate signature (already done in handler.ts)
  // 2. Write status=ANALYZING to DDB
  // 3. Enqueue SQS on-demand message
  // 4. Return type 5 — Discord shows "Lucan is thinking..."
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 5 }),  // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
  };
  // Card arrives later via the Streams path (streamsProcessor.ts)
}

// PING (type 1) — return PONG immediately, no DDB, no SQS
if (interaction.type === InteractionType.PING) {
  return { statusCode: 200, body: JSON.stringify({ type: 1 }) };
}
```

The `type` constants: `1` = PONG, `4` = CHANNEL_MESSAGE_WITH_SOURCE (immediate), `5` = DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE.

---

### Signal Record Creation Contract

The Python Lambda MUST write `status=ANALYZING` to DynamoDB as its **first action after SQS dequeue**, before calling TradingAgents or any external service. This enables idempotency checking and gives the Streams consumer an anchor to check against.

Idempotency check: before writing, query for an existing record with the same `analysis_id`. If the record exists and `status ≠ ANALYZING`, it is a redelivered SQS message — skip and return success to prevent duplicate processing.

```python
# services/analysis/handler.py (Epic 2a)
def process_message(message: dict, repo: SignalRepository) -> None:
    analysis_id = message['analysis_id']

    # Idempotency: skip if already processed
    existing = repo.get_signal(analysis_id)
    if existing and existing['status'] != 'ANALYZING':
        logger.info('Skipping redelivered message', extra={'analysis_id': analysis_id})
        return

    # FIRST action: write ANALYZING before any external calls
    repo.create_signal({
        'analysis_id': analysis_id,
        'ticker': message['ticker'],
        'status': 'ANALYZING',
        'created_at': datetime.utcnow().isoformat() + 'Z',
        ...
    })

    # Only now call TradingAgents
    result = ta.propagate(message['ticker'], message['analysis_date'])
    ...
```

---

### Hexagonal Handler Pattern

Both Lambdas use a `makeHandler(repo)` factory. The top-level `handler` export wires the real DynamoDB adapter; tests inject a mock. No code inside `handler.ts` or `handler.py` ever imports the AWS SDK directly — that coupling lives only in the adapter (`signalRepo.ts` / `signal_repo.py`).

```typescript
// services/discord-bot/src/handler.ts (Epic 3)
export function makeHandler(repo: SignalRepository): LambdaHandler {
  return async (event) => {
    if ('Records' in event) return handleStreams(event, repo);
    return handleInteraction(event, repo);
  };
}

// Production entry: wire the real adapter
const repo = new DynamoSignalRepo(process.env.SIGNALS_TABLE_NAME!);
export const handler = makeHandler(repo);
```

```python
# services/analysis/handler.py (Epic 2a)
def make_handler(repo: SignalRepository):
    def handler(event, context):
        for record in event['Records']:
            process_message(json.loads(record['body']), repo)
    return handler

repo = DynamoSignalRepo(os.environ['SIGNALS_TABLE_NAME'])
handler = make_handler(repo)
```

**Never test with real DynamoDB.** Inject a `MockSignalRepository` in unit tests.

---

### Cross-Runtime Contract: signal-schema.json

`shared/signal-schema.json` (JSON Schema draft-07) is the single source of truth for the signal record structure. TypeScript Zod types are **derived** from it, not hand-authored. Python validates incoming data against it using `jsonschema`.

If you add a field to the signal record, you must update **all three** in one PR:
1. `shared/signal-schema.json` — the schema itself
2. TypeScript Zod schema in `services/discord-bot/src/` — regenerate from JSON Schema
3. Python validation in `services/analysis/schema_validator.py`

The CI gate (`ci.yml`) validates `fixtures/signal-record.json` against the schema in both runtimes. A schema violation blocks merge.

---

## Field Naming Convention

All system boundary fields (DynamoDB attributes, SQS payloads, structured logs, JSON contract) use **snake_case**. camelCase is permitted only inside TypeScript-internal variables.

| Location | Required case | Example |
|----------|--------------|---------|
| DynamoDB attribute names | snake_case | `analysis_id`, `entry_price`, `created_at` |
| SQS message payload fields | snake_case | `analysis_id`, `channel_id`, `interaction_token` |
| Structured log fields (Powertools) | snake_case | `duration_ms`, `signal_rating`, `delivery_method` |
| `signal-schema.json` fields | snake_case | `stop_loss`, `price_target`, `time_horizon` |
| TypeScript internal variables | camelCase | `analysisId`, `entryPrice`, `channelId` |
| Python variables | snake_case (always) | `analysis_id`, `entry_price`, `channel_id` |

**Boundary rule for TypeScript:** the transition between camelCase variables and snake_case external data happens at `unmarshall()` / `marshall()`. Read `record.entry_price` directly from unmarshalled DDB output; assign to a local camelCase variable only if needed. Never rename fields before writing back to DDB — write snake_case directly.

---

## Implementation Gotchas

These six issues will silently break your build or produce a runtime bug if you don't know about them.

| # | Gotcha | Fix |
|---|--------|-----|
| G-01 | `PythonFunction` construct requires Docker running at `cdk synth` time | `make dev-setup` runs `scripts/check-docker.sh` as a presynth guard; Docker must be running before synthesis |
| G-02 | `cdk synth` → `sam local` breaks without `--no-staging` | Use `npm run sam:invoke`; this flag is baked in. Never invoke `sam local` manually |
| G-03 | SAM local ignores CDK env vars → `env.json` drifts silently after each deploy | Run `npx ts-node scripts/gen-env-json.ts` after every `cdk deploy`; also runs in `make dev-setup` |
| G-04 | TypeScript types are erased at runtime — no Python validation | `shared/signal-schema.json` + CI validation gate; never rely on TypeScript types to protect the Python boundary |
| G-05 | `makeHandler` factory means Lambda cold start never touches DDB | If you add module-level code that calls the AWS SDK, you break testability and cold start; keep side effects inside the factory |
| G-06 | `@aws-lambda-python-alpha` alpha API can break on minor CDK version update | Version is pinned exactly in `package.json`; read the upgrade notes before bumping CDK |

---

## G-04 Recovery Target

When `cdk synth` or CDK synthesis behaves unexpectedly — missing constructs, stale outputs, mysterious type errors — the first action is always:

```bash
make recover
```

This removes `cdk.out/`, `.cdk.staging/`, and `node_modules/`, then runs `npm ci`. After recovery, run `make dev-setup` to rebuild `env.json`.

**First-time setup:**
```bash
make dev-setup       # installs deps, synthesizes, generates env.json
```

**After every deploy** (required for `sam local` to pick up new env vars):
```bash
npx ts-node scripts/gen-env-json.ts
```

---

## Testing Conventions

Tests are co-located with source files. There is no separate `__tests__/` directory.

```
services/analysis/
├── handler.py
├── test_handler.py          ← co-located
└── schema_validator.py
└── test_schema_validator.py ← co-located

services/discord-bot/src/
├── handler.ts
├── handler.test.ts          ← co-located
└── cardFormatter.ts
└── cardFormatter.test.ts    ← co-located
```

**Run tests:**
```bash
# TypeScript
npm test

# Python
pytest services/analysis/

# CDK infrastructure assertions
npm test   # Jest picks up test/ directory
```

CDK assertion tests use `aws-cdk-lib/assertions` (`Template.fromStack()`). Do not deploy stacks to verify IAM or resource configuration — write a CDK assertion test.

**Never test with real DynamoDB or the real Discord API.** Inject a mock `SignalRepository` in unit tests. Integration tests that hit real AWS are in files suffixed `.integration.test.ts` or `test_*_integration.py` and are excluded from CI.

**Streams handler must never throw.** Return `{ batchItemFailures: [{ itemIdentifier: record.dynamodb!.SequenceNumber }] }` on item-level failures. Throwing causes the entire SQS batch to retry, producing duplicate Discord posts.

---

## Deployment

**One-time OIDC bootstrap** (local machine, admin credentials, once per AWS account):
```bash
npx cdk deploy GitHubOidcStack
```

After this, all deploys run via GitHub Actions — no local deploys to dev or prod.

**Dev deploy:** push to `dev` branch → GitHub Actions runs tests → deploys `HorizonDevStack` automatically.

**Prod deploy:** merge to `main` → GitHub Actions requires manual approval in the `prod` environment before deploying `HorizonProdStack`.

**After any deploy**, regenerate `env.json` for SAM local:
```bash
npx ts-node scripts/gen-env-json.ts
```

**Resource naming:** all AWS resources are prefixed with `envName` (`dev` or `prod`). Never hardcode `'horizon-prod-signals'` in Lambda code — always read from `process.env.SIGNALS_TABLE_NAME` or `os.environ['SIGNALS_TABLE_NAME']`.

**Secrets Manager paths:**
- Python Lambda: `/horizon/{envName}/anthropic/*`, `/horizon/{envName}/discord/*`
- TypeScript Lambda: `/horizon/{envName}/discord/*`
- Separate paths enable independent credential rotation per runtime.

---

## Onboarding a New Discord Member

`/prep-for-arrival` is invoked manually by Khamal or a Co-Admin. Three-step checklist:
1. Send Discord invite link
2. Run `/prep-for-arrival` in the server — this provisions the member's private channel
3. Verify Lucan's welcome message arrives in the new channel (confirms bot is live)

Lucan's welcome message discloses AI identity per compliance requirements. If it doesn't appear, check the TypeScript Lambda logs in CloudWatch (`/horizon/{env}/discord-bot`).
