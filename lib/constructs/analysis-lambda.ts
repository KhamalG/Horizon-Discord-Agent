import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import * as path from 'path';

export interface AnalysisLambdaConstructProps {
  envName: 'dev' | 'prod';
  cronQueue: sqs.Queue;
  role: iam.Role;
}

export class AnalysisLambdaConstruct extends Construct {
  readonly analysisFunction: lambda.DockerImageFunction;

  constructor(scope: Construct, id: string, props: AnalysisLambdaConstructProps) {
    super(scope, id);
    const { envName, cronQueue, role } = props;

    const logGroup = new logs.LogGroup(this, 'AnalysisLogGroup', {
      logGroupName: `/aws/lambda/horizon-${envName}-analysis`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.analysisFunction = new lambda.DockerImageFunction(this, 'AnalysisFunction', {
      functionName: `horizon-${envName}-analysis`,
      // Build context is services/analysis/ so the fingerprint only hashes Python
      // source files — avoids the circular-snapshot problem where __snapshots__/*.snap
      // (inside the repo-root context) would change the hash on every test update.
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../../services/analysis'), {
        file: 'Dockerfile',
      }),
      memorySize: 3008,
      timeout: cdk.Duration.seconds(932),
      architecture: lambda.Architecture.ARM_64,
      role,
      logGroup,
    });

    this.analysisFunction.addEventSource(
      new SqsEventSource(cronQueue, {
        batchSize: 1,
        reportBatchItemFailures: true,
      }),
    );
  }
}
