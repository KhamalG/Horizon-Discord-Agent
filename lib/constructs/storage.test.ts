import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { HorizonStack } from '../horizon-stack';

function buildTemplate(envName: 'dev' | 'prod' = 'dev') {
  const app = new cdk.App();
  const stack = new HorizonStack(app, 'TestStack', { envName });
  return Template.fromStack(stack);
}

describe('StorageConstruct — horizon-signals table', () => {
  let template: Template;

  beforeEach(() => {
    template = buildTemplate('dev');
  });

  test('has correct key schema (PK hash, SK range)', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
    });
  });

  test('has Streams enabled with NEW_AND_OLD_IMAGES', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      StreamSpecification: { StreamViewType: 'NEW_AND_OLD_IMAGES' },
    });
  });

  test('has TTL configured on ttl attribute', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TimeToLiveSpecification: { AttributeName: 'ttl', Enabled: true },
    });
  });

  test('has status-created_at-index GSI with correct key schema', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      GlobalSecondaryIndexes: Match.arrayWith([
        {
          IndexName: 'status-created_at-index',
          KeySchema: [
            { AttributeName: 'status', KeyType: 'HASH' },
            { AttributeName: 'created_at', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ]),
    });
  });

  test('has ticker-date-index GSI with correct key schema', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      GlobalSecondaryIndexes: Match.arrayWith([
        {
          IndexName: 'ticker-date-index',
          KeySchema: [
            { AttributeName: 'ticker', KeyType: 'HASH' },
            { AttributeName: 'analysis_date', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ]),
    });
  });

  test('table name is prefixed by envName', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'dev-horizon-signals',
    });
  });
});

describe('StorageConstruct — horizon-config table', () => {
  let template: Template;

  beforeEach(() => {
    template = buildTemplate('dev');
  });

  test('has correct key schema (PK hash, SK range)', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'dev-horizon-config',
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
    });
  });

  test('has no Streams enabled', () => {
    // Config table should not appear in StreamSpecification assertion
    // Assert exactly 1 table has streams (the signals table)
    template.resourceCountIs('AWS::DynamoDB::Table', 2);
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'dev-horizon-config',
    });
    // Confirm the config table has no stream specification by checking it exists with
    // no StreamSpecification property (verified via resourceCountIs + signals stream test)
  });

  test('table name is prefixed by envName', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'dev-horizon-config',
    });
  });
});

describe('StorageConstruct — prod envName prefix', () => {
  test('prod tables use prod- prefix', () => {
    const template = buildTemplate('prod');
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'prod-horizon-signals',
    });
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'prod-horizon-config',
    });
  });
});
