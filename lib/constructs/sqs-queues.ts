import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface SqsQueuesConstructProps {
  envName: 'dev' | 'prod';
}

export class SqsQueuesConstruct extends Construct {
  readonly cronQueue: sqs.Queue;
  readonly cronDlq: sqs.Queue;
  readonly cronQueueArn: string;
  readonly cronQueueUrl: string;

  constructor(scope: Construct, id: string, props: SqsQueuesConstructProps) {
    super(scope, id);
    const { envName } = props;

    this.cronDlq = new sqs.Queue(this, 'CronDlq', {
      queueName: `${envName}-horizon-cron-dlq`,
      retentionPeriod: cdk.Duration.days(14),
    });

    this.cronQueue = new sqs.Queue(this, 'CronQueue', {
      queueName: `${envName}-horizon-cron-queue`,
      visibilityTimeout: cdk.Duration.seconds(5592),
      retentionPeriod: cdk.Duration.days(4),
      deadLetterQueue: {
        queue: this.cronDlq,
        maxReceiveCount: 2,
      },
    });

    this.cronQueueArn = this.cronQueue.queueArn;
    this.cronQueueUrl = this.cronQueue.queueUrl;
  }
}
