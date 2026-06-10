import * as cdk from 'aws-cdk-lib';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface SecretsConstructProps {
  envName: 'dev' | 'prod';
}

export class SecretsConstruct extends Construct {
  readonly discordBotTokenArn: string;
  readonly discordPublicKeyArn: string;
  readonly anthropicApiKeyArn: string;

  constructor(scope: Construct, id: string, props: SecretsConstructProps) {
    super(scope, id);
    const { envName } = props;

    const botTokenSecret = new sm.Secret(this, 'DiscordBotToken', {
      secretName: `/horizon/${envName}/discord/bot-token`,
      description: 'Lucan Discord bot token — replace placeholder before deploying bot',
      secretStringValue: cdk.SecretValue.unsafePlainText(
        'PLACEHOLDER - replace before deploying bot'
      ),
    });
    cdk.Tags.of(botTokenSecret).add('envName', envName);
    cdk.Tags.of(botTokenSecret).add('service', 'horizon-secrets');

    const publicKeySecret = new sm.Secret(this, 'DiscordPublicKey', {
      secretName: `/horizon/${envName}/discord/public-key`,
      description:
        'Lucan Discord application public key for Ed25519 signature validation — replace placeholder',
      secretStringValue: cdk.SecretValue.unsafePlainText(
        'PLACEHOLDER - replace before deploying bot'
      ),
    });
    cdk.Tags.of(publicKeySecret).add('envName', envName);
    cdk.Tags.of(publicKeySecret).add('service', 'horizon-secrets');

    const anthropicKeySecret = new sm.Secret(this, 'AnthropicApiKey', {
      secretName: `/horizon/${envName}/anthropic/api-key`,
      description:
        'Anthropic API key for TradingAgents analysis — replace placeholder before deploying Python Lambda',
      secretStringValue: cdk.SecretValue.unsafePlainText(
        'PLACEHOLDER - replace before deploying analysis lambda'
      ),
    });
    cdk.Tags.of(anthropicKeySecret).add('envName', envName);
    cdk.Tags.of(anthropicKeySecret).add('service', 'horizon-secrets');

    this.discordBotTokenArn = botTokenSecret.secretArn;
    this.discordPublicKeyArn = publicKeySecret.secretArn;
    this.anthropicApiKeyArn = anthropicKeySecret.secretArn;
  }
}
