// Skeleton Discord bot Lambda handler — Epic 1 scope: ping verification only.
// Full interaction routing implemented in Epic 3 (interactionHandler.ts).
import { verifyKey } from 'discord-interactions';

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
if (!PUBLIC_KEY) {
  throw new Error('DISCORD_PUBLIC_KEY environment variable is not set');
}

export const handler = async (event: {
  headers: Record<string, string | undefined>;
  body: string | null;
  isBase64Encoded?: boolean;
}) => {
  const signature = event.headers['x-signature-ed25519'];
  const timestamp = event.headers['x-signature-timestamp'];

  // Lambda Function URLs may base64-encode the body for non-text content types
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body ?? '', 'base64').toString('utf-8')
    : (event.body ?? '');

  if (!signature || !timestamp) {
    return { statusCode: 401, body: 'Missing signature headers' };
  }

  const isValid = verifyKey(rawBody, signature, timestamp, PUBLIC_KEY);
  if (!isValid) {
    return { statusCode: 401, body: 'Invalid signature' };
  }

  let interaction: { type: number };
  try {
    interaction = JSON.parse(rawBody) as { type: number };
  } catch {
    return { statusCode: 400, body: 'Invalid JSON body' };
  }

  // Discord PING — must respond immediately with PONG (type 1)
  if (interaction.type === 1) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 1 }),
    };
  }

  // All other interaction types: placeholder until Epic 3
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 4, data: { content: 'Lucan is warming up...' } }),
  };
};
