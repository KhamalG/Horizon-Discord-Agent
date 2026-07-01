import { CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as path from 'path';
import { Construct } from 'constructs';
import { StorageConstruct } from './constructs/storage';
import { SecretsConstruct } from './constructs/secrets';
import { IamRolesConstruct } from './constructs/iam-roles';
import { SqsQueuesConstruct } from './constructs/sqs-queues';
import { AnalysisLambdaConstruct } from './constructs/analysis-lambda';

export interface HorizonStackProps extends StackProps {
  envName: 'dev' | 'prod';
}

export class HorizonStack extends Stack {
  readonly envName: 'dev' | 'prod';
  readonly storage: StorageConstruct;
  readonly secrets: SecretsConstruct;
  readonly iamRoles: IamRolesConstruct;

  constructor(scope: Construct, id: string, props: HorizonStackProps) {
    super(scope, id, {
      ...props,
      stackName: `horizon-${props.envName}`,
    });
    this.envName = props.envName;

    this.storage = new StorageConstruct(this, 'Storage', {
      envName: props.envName,
    });

    // Secrets Manager stubs — placeholders replaced post-deploy via aws secretsmanager put-secret-value
    this.secrets = new SecretsConstruct(this, 'Secrets', {
      envName: props.envName,
    });

    const queues = new SqsQueuesConstruct(this, 'SqsQueues', {
      envName: props.envName,
    });

    // Three IAM roles with zero write-permission overlap
    this.iamRoles = new IamRolesConstruct(this, 'IamRoles', {
      signalsTableArn: this.storage.signalsTableArn,
      configTableArn: this.storage.configTableArn,
      signalsStreamArn: this.storage.signalsTableStreamArn,
      cronQueueArn: queues.cronQueueArn,
      envName: props.envName,
    });

    const analysisLambda = new AnalysisLambdaConstruct(this, 'AnalysisLambda', {
      envName: props.envName,
      cronQueue: queues.cronQueue,
      role: this.iamRoles.pythonLambdaRole,
    });

    // N-3: all resource identifiers injected as env vars at stack level, never hardcoded in handler
    analysisLambda.analysisFunction.addEnvironment('SIGNALS_TABLE_NAME', this.storage.signalsTable.tableName);
    analysisLambda.analysisFunction.addEnvironment('CONFIG_TABLE_NAME', this.storage.configTable.tableName);
    analysisLambda.analysisFunction.addEnvironment('CRON_QUEUE_URL', queues.cronQueueUrl);

    // SSM Parameter Store stubs for Discord channel IDs
    this.createSsmParameters();

    // Skeleton Discord bot Lambda — Epic 1 scope (ping verification only)
    this.createDiscordBotLambda();
  }

  private createDiscordBotLambda(): void {
    const publicKeySecret = sm.Secret.fromSecretNameV2(
      this,
      'DiscordPublicKeyRef',
      `/horizon/${this.envName}/discord/public-key`
    );

    const botFn = new NodejsFunction(this, 'DiscordBotFunction', {
      functionName: `horizon-${this.envName}-discord-bot`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, '../services/discord-bot/src/handler.ts'),
      handler: 'handler',
      role: this.iamRoles.typescriptLambdaRole,
      timeout: Duration.seconds(3),
      environment: {
        // CloudFormation resolves this from Secrets Manager at deploy time.
        // Must store real public key before deploying (Phase 2 of story 1-6).
        DISCORD_PUBLIC_KEY: publicKeySecret.secretValue.unsafeUnwrap().toString(),
      },
    });

    const fnUrl = botFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['https://discord.com'],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ['Content-Type', 'X-Signature-Ed25519', 'X-Signature-Timestamp'],
      },
    });

    // Printed after cdk deploy — paste this URL into Discord Developer Portal
    new CfnOutput(this, 'DiscordBotFunctionUrl', {
      value: fnUrl.url,
      description: 'Paste into Discord Developer Portal → General Information → Interactions Endpoint URL',
    });
  }

  private createSsmParameters(): void {
    const channels = [
      { name: 'bot-testing-channel-id', suffix: 'bot-testing-channel-id' },
      { name: 'khamal-analysis-channel-id', suffix: 'khamal-analysis-channel-id' },
    ];

    for (const channel of channels) {
      new ssm.StringParameter(this, `Ssm${this.envName}${channel.name}`, {
        parameterName: `/horizon/${this.envName}/discord/${channel.suffix}`,
        stringValue: 'PLACEHOLDER',
        description: `Horizon Discord ${channel.name} for ${this.envName} environment`,
      });
    }
  }
}

export class HorizonDevStack extends HorizonStack {}

export class HorizonProdStack extends HorizonStack {}
