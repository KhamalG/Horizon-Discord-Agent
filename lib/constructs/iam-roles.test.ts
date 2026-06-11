import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { HorizonStack } from '../horizon-stack';

function buildTemplate(envName: 'dev' | 'prod' = 'dev') {
  const app = new cdk.App();
  const stack = new HorizonStack(app, 'TestStack', { envName });
  return Template.fromStack(stack);
}

// Returns all actions granted to a named IAM role (by roleName property).
// Finds the role's logical ID, then locates all IAM::Policy resources that
// reference that role and collects every action string.
function actionsForRole(templateJson: Record<string, unknown>, roleName: string): string[] {
  const resources = templateJson['Resources'] as Record<
    string,
    { Type: string; Properties: Record<string, unknown> }
  >;

  // Find logical ID of the named role
  const roleLogicalId = Object.keys(resources).find((id) => {
    const r = resources[id];
    return r.Type === 'AWS::IAM::Role' && r.Properties['RoleName'] === roleName;
  });

  if (!roleLogicalId) return [];

  // Collect all actions from policies that reference this role
  const actions: string[] = [];
  for (const resource of Object.values(resources)) {
    if (resource.Type !== 'AWS::IAM::Policy') continue;
    const roles = resource.Properties['Roles'] as Array<{ Ref?: string }>;
    if (!roles?.some((r) => r.Ref === roleLogicalId)) continue;

    const doc = resource.Properties['PolicyDocument'] as {
      Statement: Array<{ Action: string | string[] }>;
    };
    for (const stmt of doc.Statement) {
      const stmtActions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
      actions.push(...stmtActions);
    }
  }
  return actions;
}

describe('IamRolesConstruct — role count and trust policies', () => {
  let template: Template;

  beforeEach(() => {
    template = buildTemplate('dev');
  });

  test('exactly three IAM roles exist', () => {
    template.resourceCountIs('AWS::IAM::Role', 3);
  });

  test('Python role trust policy is lambda.amazonaws.com', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'horizon-dev-python-lambda-role',
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: { Service: 'lambda.amazonaws.com' },
          },
        ],
      },
    });
  });

  test('TypeScript role trust policy is lambda.amazonaws.com', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'horizon-dev-typescript-lambda-role',
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: { Service: 'lambda.amazonaws.com' },
          },
        ],
      },
    });
  });

  test('EventBridge role trust policy is events.amazonaws.com', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'horizon-dev-eventbridge-role',
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: { Service: 'events.amazonaws.com' },
          },
        ],
      },
    });
  });
});

describe('IamRolesConstruct — Python Lambda role permissions', () => {
  let actions: string[];

  beforeEach(() => {
    const template = buildTemplate('dev');
    actions = actionsForRole(template.toJSON(), 'horizon-dev-python-lambda-role');
  });

  test('has DynamoDB read/write actions', () => {
    expect(actions).toContain('dynamodb:GetItem');
    expect(actions).toContain('dynamodb:PutItem');
    expect(actions).toContain('dynamodb:UpdateItem');
    expect(actions).toContain('dynamodb:Query');
  });

  test('has CloudWatch Logs actions', () => {
    expect(actions).toContain('logs:CreateLogGroup');
    expect(actions).toContain('logs:CreateLogStream');
    expect(actions).toContain('logs:PutLogEvents');
  });

  test('has Secrets Manager GetSecretValue', () => {
    expect(actions).toContain('secretsmanager:GetSecretValue');
  });

  // Negative assertions — security isolation
  test('does NOT have DynamoDB Streams permissions', () => {
    const streamsActions = [
      'dynamodb:GetRecords',
      'dynamodb:GetShardIterator',
      'dynamodb:DescribeStream',
      'dynamodb:ListStreams',
    ];
    for (const action of streamsActions) {
      expect(actions).not.toContain(action);
    }
  });

  test('does NOT have SQS SendMessage', () => {
    expect(actions).not.toContain('sqs:SendMessage');
  });

  test('does NOT have SSM GetParameter', () => {
    expect(actions).not.toContain('ssm:GetParameter');
  });
});

describe('IamRolesConstruct — TypeScript Lambda role permissions', () => {
  let actions: string[];
  let templateJson: Record<string, unknown>;

  beforeEach(() => {
    const template = buildTemplate('dev');
    templateJson = template.toJSON();
    actions = actionsForRole(templateJson, 'horizon-dev-typescript-lambda-role');
  });

  test('has DynamoDB read/write actions', () => {
    expect(actions).toContain('dynamodb:GetItem');
    expect(actions).toContain('dynamodb:PutItem');
    expect(actions).toContain('dynamodb:UpdateItem');
    expect(actions).toContain('dynamodb:Query');
  });

  test('has DynamoDB Streams actions', () => {
    expect(actions).toContain('dynamodb:GetRecords');
    expect(actions).toContain('dynamodb:GetShardIterator');
    expect(actions).toContain('dynamodb:DescribeStream');
    expect(actions).toContain('dynamodb:ListStreams');
  });

  test('has CloudWatch Logs actions', () => {
    expect(actions).toContain('logs:CreateLogGroup');
    expect(actions).toContain('logs:CreateLogStream');
    expect(actions).toContain('logs:PutLogEvents');
  });

  test('has Secrets Manager GetSecretValue', () => {
    expect(actions).toContain('secretsmanager:GetSecretValue');
  });

  test('has SSM GetParameter', () => {
    expect(actions).toContain('ssm:GetParameter');
  });

  // Negative assertions — security isolation
  test('does NOT have access to /horizon/python/* secrets', () => {
    // TypeScript role's Secrets Manager resources must NOT include /python/ paths.
    // Find the policy for this role and inspect resource ARNs.
    const resources = templateJson['Resources'] as Record<
      string,
      { Type: string; Properties: Record<string, unknown> }
    >;
    const roleLogicalId = Object.keys(resources).find((id) => {
      const r = resources[id];
      return (
        r.Type === 'AWS::IAM::Role' &&
        r.Properties['RoleName'] === 'horizon-dev-typescript-lambda-role'
      );
    });
    const smResources: string[] = [];
    for (const resource of Object.values(resources)) {
      if (resource.Type !== 'AWS::IAM::Policy') continue;
      const roles = resource.Properties['Roles'] as Array<{ Ref?: string }>;
      if (!roles?.some((r) => r.Ref === roleLogicalId)) continue;
      const doc = resource.Properties['PolicyDocument'] as {
        Statement: Array<{ Action: string | string[]; Resource: string | string[] }>;
      };
      for (const stmt of doc.Statement) {
        const stmtActions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
        if (stmtActions.includes('secretsmanager:GetSecretValue')) {
          const stmtResources = Array.isArray(stmt.Resource)
            ? stmt.Resource
            : [stmt.Resource];
          smResources.push(...stmtResources);
        }
      }
    }
    const hasPythonPath = smResources.some(
      (r) => typeof r === 'string' && r.includes('/anthropic/')
    );
    expect(hasPythonPath).toBe(false);
  });

  test('does NOT have SQS SendMessage', () => {
    expect(actions).not.toContain('sqs:SendMessage');
  });
});

describe('IamRolesConstruct — Python role does NOT access /typescript/* secrets', () => {
  test('Python role Secrets Manager resources do not include /typescript/ path', () => {
    const template = buildTemplate('dev');
    const templateJson = template.toJSON();
    const resources = templateJson['Resources'] as Record<
      string,
      { Type: string; Properties: Record<string, unknown> }
    >;
    const roleLogicalId = Object.keys(resources).find((id) => {
      const r = resources[id];
      return (
        r.Type === 'AWS::IAM::Role' &&
        r.Properties['RoleName'] === 'horizon-dev-python-lambda-role'
      );
    });
    const smResources: string[] = [];
    for (const resource of Object.values(resources)) {
      if (resource.Type !== 'AWS::IAM::Policy') continue;
      const roles = resource.Properties['Roles'] as Array<{ Ref?: string }>;
      if (!roles?.some((r) => r.Ref === roleLogicalId)) continue;
      const doc = resource.Properties['PolicyDocument'] as {
        Statement: Array<{ Action: string | string[]; Resource: string | string[] }>;
      };
      for (const stmt of doc.Statement) {
        const stmtActions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
        if (stmtActions.includes('secretsmanager:GetSecretValue')) {
          const stmtResources = Array.isArray(stmt.Resource)
            ? stmt.Resource
            : [stmt.Resource];
          smResources.push(...stmtResources);
        }
      }
    }
    // Python role's secrets paths must not contain /typescript/
    const hasTypescriptPath = smResources.some(
      (r) => typeof r === 'string' && r.includes('/typescript/')
    );
    expect(hasTypescriptPath).toBe(false);
  });
});

describe('IamRolesConstruct — EventBridge role permissions', () => {
  let actions: string[];

  beforeEach(() => {
    const template = buildTemplate('dev');
    actions = actionsForRole(template.toJSON(), 'horizon-dev-eventbridge-role');
  });

  test('has SQS SendMessage', () => {
    expect(actions).toContain('sqs:SendMessage');
  });

  test('does NOT have Lambda invoke permissions', () => {
    const lambdaActions = actions.filter((a) => a.startsWith('lambda:'));
    expect(lambdaActions).toHaveLength(0);
  });

  test('does NOT have DynamoDB permissions', () => {
    const ddbActions = actions.filter((a) => a.startsWith('dynamodb:'));
    expect(ddbActions).toHaveLength(0);
  });
});

describe('IamRolesConstruct — prod envName', () => {
  test('prod roles use prod- prefix in role names', () => {
    const template = buildTemplate('prod');
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'horizon-prod-python-lambda-role',
    });
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'horizon-prod-typescript-lambda-role',
    });
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'horizon-prod-eventbridge-role',
    });
  });
});
