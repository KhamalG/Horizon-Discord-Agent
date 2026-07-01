import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Template } from 'aws-cdk-lib/assertions';
import { AnalysisLambdaConstruct } from './analysis-lambda';

function buildTemplate() {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'TestStack');
  const role = new iam.Role(stack, 'TestRole', {
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  });
  const queue = new sqs.Queue(stack, 'TestQueue');
  new AnalysisLambdaConstruct(stack, 'AnalysisLambda', {
    envName: 'dev',
    cronQueue: queue,
    role,
  });
  return Template.fromStack(stack);
}

describe('AnalysisLambdaConstruct', () => {
  test('Lambda has correct memory size', () => {
    buildTemplate().hasResourceProperties('AWS::Lambda::Function', {
      MemorySize: 3008,
    });
  });

  test('Lambda has correct timeout', () => {
    buildTemplate().hasResourceProperties('AWS::Lambda::Function', {
      Timeout: 932,
    });
  });

  test('Lambda uses ARM_64 architecture', () => {
    buildTemplate().hasResourceProperties('AWS::Lambda::Function', {
      Architectures: ['arm64'],
    });
  });

  test('SQS event source has batchSize=1 and ReportBatchItemFailures', () => {
    buildTemplate().hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      BatchSize: 1,
      FunctionResponseTypes: ['ReportBatchItemFailures'],
    });
  });

  test('log group has ONE_MONTH retention', () => {
    buildTemplate().hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/lambda/horizon-dev-analysis',
      RetentionInDays: 30,
    });
  });
});
