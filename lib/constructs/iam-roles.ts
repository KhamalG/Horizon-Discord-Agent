import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface IamRolesConstructProps {
  signalsTableArn: string;
  configTableArn: string;
  signalsStreamArn: string;
  cronQueueArn?: string;
  envName: 'dev' | 'prod';
}

export class IamRolesConstruct extends Construct {
  readonly pythonLambdaRole: iam.Role;
  readonly typescriptLambdaRole: iam.Role;
  readonly eventBridgeRole: iam.Role;

  constructor(scope: Construct, id: string, props: IamRolesConstructProps) {
    super(scope, id);
    const { signalsTableArn, configTableArn, signalsStreamArn, cronQueueArn, envName } = props;

    // Placeholder queue ARN when Epic 2a queue doesn't exist yet
    const queueArn =
      cronQueueArn ?? `arn:aws:sqs:*:*:${envName}-horizon-cron-queue`;

    this.pythonLambdaRole = this.createPythonRole(
      signalsTableArn,
      configTableArn,
      envName
    );
    this.typescriptLambdaRole = this.createTypescriptRole(
      signalsTableArn,
      signalsStreamArn,
      envName
    );
    this.eventBridgeRole = this.createEventBridgeRole(queueArn, envName);
  }

  private createPythonRole(
    signalsTableArn: string,
    configTableArn: string,
    envName: string
  ): iam.Role {
    const role = new iam.Role(this, 'PythonLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      roleName: `horizon-${envName}-python-lambda-role`,
    });

    cdk.Tags.of(role).add('envName', envName);
    cdk.Tags.of(role).add('service', 'horizon-python-lambda');

    // DynamoDB: both signals and config tables (Python reads/writes both)
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:Query',
        ],
        resources: [
          signalsTableArn,
          `${signalsTableArn}/index/*`,
          configTableArn,
          `${configTableArn}/index/*`,
        ],
      })
    );

    // Secrets Manager: Python-scoped paths only
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          `arn:aws:secretsmanager:*:*:secret:/horizon/${envName}/anthropic/*`,
          `arn:aws:secretsmanager:*:*:secret:/horizon/${envName}/discord/*`,
        ],
      })
    );

    // CloudWatch Logs (required for Lambda execution)
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['arn:aws:logs:*:*:*'],
      })
    );

    // X-Ray tracing (Lambda Powertools Tracer)
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['xray:PutTraceSegments', 'xray:PutTelemetryRecords'],
        resources: ['*'],
      })
    );

    return role;
  }

  private createTypescriptRole(
    signalsTableArn: string,
    signalsStreamArn: string,
    envName: string
  ): iam.Role {
    const role = new iam.Role(this, 'TypescriptLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      roleName: `horizon-${envName}-typescript-lambda-role`,
    });

    cdk.Tags.of(role).add('envName', envName);
    cdk.Tags.of(role).add('service', 'horizon-typescript-lambda');

    // DynamoDB: signals table only (NOT config table)
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:Query',
        ],
        resources: [signalsTableArn, `${signalsTableArn}/index/*`],
      })
    );

    // DynamoDB Streams: signals table stream only
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:GetRecords',
          'dynamodb:GetShardIterator',
          'dynamodb:DescribeStream',
          'dynamodb:ListStreams',
        ],
        resources: [signalsStreamArn],
      })
    );

    // Secrets Manager: TypeScript-scoped discord paths only (bot-token, public-key)
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          `arn:aws:secretsmanager:*:*:secret:/horizon/${envName}/discord/*`,
        ],
      })
    );

    // SSM: Discord channel parameters (prod + dev)
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ssm:GetParameter'],
        resources: [
          `arn:aws:ssm:*:*:parameter/horizon/prod/discord/*`,
          `arn:aws:ssm:*:*:parameter/horizon/dev/discord/*`,
        ],
      })
    );

    // CloudWatch Logs
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['arn:aws:logs:*:*:*'],
      })
    );

    // X-Ray tracing
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['xray:PutTraceSegments', 'xray:PutTelemetryRecords'],
        resources: ['*'],
      })
    );

    return role;
  }

  private createEventBridgeRole(queueArn: string, envName: string): iam.Role {
    const role = new iam.Role(this, 'EventBridgeRole', {
      assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
      roleName: `horizon-${envName}-eventbridge-role`,
    });

    cdk.Tags.of(role).add('envName', envName);
    cdk.Tags.of(role).add('service', 'horizon-eventbridge');

    // SQS: cron queue send only — no Lambda invoke permissions
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sqs:SendMessage'],
        resources: [queueArn],
      })
    );

    return role;
  }
}
