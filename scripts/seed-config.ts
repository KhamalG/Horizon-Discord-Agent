#!/usr/bin/env ts-node
/**
 * Seeds the horizon-config DynamoDB table with Lucan persona v1.0.0.
 * Usage: npx ts-node scripts/seed-config.ts --env dev|prod
 *
 * Idempotent: skips write if ACTIVE pointer already exists.
 */

import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';

const args = process.argv.slice(2);
const envIndex = args.indexOf('--env');
if (envIndex === -1 || !args[envIndex + 1]) {
  console.error('Usage: ts-node scripts/seed-config.ts --env dev|prod');
  process.exit(1);
}
const env = args[envIndex + 1];
if (env !== 'dev' && env !== 'prod') {
  console.error('--env must be "dev" or "prod"');
  process.exit(1);
}

const TABLE_NAME = `${env}-horizon-config`;
const VERSIONED_SK = 'LUCAN#SYSTEM_PROMPT#v1.0.0';
const ACTIVE_SK = 'LUCAN#SYSTEM_PROMPT#ACTIVE';
const PK = 'LUCAN#SYSTEM_PROMPT';

const LUCAN_PROMPT = `You are Lucan, Horizon's trading intelligence. You speak with the discipline of a veteran \
trader and the clarity of a great teacher. You are direct, never condescending. You name \
what you see in the market, explain what it means in plain language, and flag the real \
risks — no fluff, no hype. You are an AI assistant, not a licensed financial advisor. \
Every signal you deliver includes a disclaimer. You believe financial knowledge is a right, \
not a privilege, and you act accordingly.`;

async function seed() {
  const client = new DynamoDBClient({});
  const createdAt = new Date().toISOString();

  // Write versioned persona item (unconditional — safe to overwrite identical content)
  await client.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: { S: PK },
        SK: { S: VERSIONED_SK },
        prompt_text: { S: LUCAN_PROMPT },
        version: { S: '1.0.0' },
        changelog: { S: 'Initial persona' },
        created_at: { S: createdAt },
      },
    })
  );
  console.log(`✅ Written versioned item: ${PK} / ${VERSIONED_SK}`);

  // Write ACTIVE pointer only if it does not already exist (idempotent)
  try {
    await client.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: { S: PK },
          SK: { S: ACTIVE_SK },
          target_sk: { S: VERSIONED_SK },
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      })
    );
    console.log(`✅ Written ACTIVE pointer → ${VERSIONED_SK}`);
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      console.log(`ℹ️  ACTIVE pointer already exists — skipping (idempotent)`);
    } else {
      throw err;
    }
  }

  console.log(`\nSeed complete for table: ${TABLE_NAME}`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
