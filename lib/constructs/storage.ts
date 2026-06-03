import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface StorageConstructProps {
  envName: 'dev' | 'prod';
}

export class StorageConstruct extends Construct {
  readonly signalsTable: dynamodb.Table;
  readonly configTable: dynamodb.Table;
  readonly signalsTableArn: string;
  readonly signalsTableStreamArn: string;
  readonly configTableArn: string;

  constructor(scope: Construct, id: string, props: StorageConstructProps) {
    super(scope, id);
    const { envName } = props;

    this.signalsTable = new dynamodb.Table(this, 'SignalsTable', {
      tableName: `${envName}-horizon-signals`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      timeToLiveAttribute: 'ttl',
    });

    this.signalsTable.addGlobalSecondaryIndex({
      indexName: 'status-created_at-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.signalsTable.addGlobalSecondaryIndex({
      indexName: 'ticker-date-index',
      partitionKey: { name: 'ticker', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'analysis_date', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.configTable = new dynamodb.Table(this, 'ConfigTable', {
      tableName: `${envName}-horizon-config`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    this.signalsTableArn = this.signalsTable.tableArn;
    // stream is guaranteed present because we enabled StreamViewType above
    this.signalsTableStreamArn = this.signalsTable.tableStreamArn!;
    this.configTableArn = this.configTable.tableArn;
  }
}
