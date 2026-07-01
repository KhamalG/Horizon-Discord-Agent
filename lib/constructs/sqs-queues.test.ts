import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { SqsQueuesConstruct } from './sqs-queues';

function buildTemplate() {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'TestStack');
  new SqsQueuesConstruct(stack, 'SqsQueues', { envName: 'dev' });
  return Template.fromStack(stack);
}

describe('SqsQueuesConstruct', () => {
  test('matches snapshot', () => {
    expect(buildTemplate().toJSON()).toMatchSnapshot();
  });

  test('DLQ has 14-day retention', () => {
    buildTemplate().hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'dev-horizon-cron-dlq',
      MessageRetentionPeriod: 1209600,
    });
  });

  test('cron queue has correct visibility, retention, and DLQ', () => {
    buildTemplate().hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'dev-horizon-cron-queue',
      VisibilityTimeout: 5592,
      MessageRetentionPeriod: 345600,
      RedrivePolicy: {
        maxReceiveCount: 2,
      },
    });
  });
});
