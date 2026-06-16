import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface GitHubOidcStackProps extends cdk.StackProps {
  /** GitHub org/owner, e.g. "KhamalG" */
  readonly githubOrg: string;
  /** GitHub repository name, e.g. "Horizon-Discord-Agent" */
  readonly githubRepo: string;
}

/**
 * One-time bootstrap stack that creates the OIDC provider and IAM role allowing
 * GitHub Actions to authenticate to AWS without long-lived access keys.
 *
 * Deploy once manually: `npx cdk deploy GitHubOidcStack`
 * This stack is intentionally NOT part of the automated CI/CD pipeline.
 */
export class GitHubOidcStack extends cdk.Stack {
  readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: GitHubOidcStackProps) {
    super(scope, id, props);

    const { githubOrg, githubRepo } = props;

    // GitHub Actions OIDC provider — one per AWS account, shared across repos.
    // Thumbprints are omitted: AWS auto-populates them for token.actions.githubusercontent.com.
    const provider = new iam.OpenIdConnectProvider(this, 'GitHubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    // Trust policy: only the specific repo, on master/dev branches and PRs from within the repo.
    const conditions: iam.Conditions = {
      StringLike: {
        'token.actions.githubusercontent.com:sub': [
          `repo:${githubOrg}/${githubRepo}:ref:refs/heads/master`,
          `repo:${githubOrg}/${githubRepo}:ref:refs/heads/dev`,
          `repo:${githubOrg}/${githubRepo}:pull_request`,
        ],
      },
      StringEquals: {
        'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
      },
    };

    this.role = new iam.Role(this, 'GitHubActionsRole', {
      roleName: 'GitHubActionsRole',
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, conditions),
      description: `Assumed by GitHub Actions for ${githubOrg}/${githubRepo} (master, dev, PRs)`,
    });

    // CloudFormation stack management (CDK uses change sets, not direct CreateStack)
    this.role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudformation:CreateChangeSet',
        'cloudformation:DeleteChangeSet',
        'cloudformation:DeleteStack',
        'cloudformation:DescribeChangeSet',
        'cloudformation:DescribeStackEvents',
        'cloudformation:DescribeStacks',
        'cloudformation:ExecuteChangeSet',
        'cloudformation:GetTemplate',
        'cloudformation:ListStackResources',
        'cloudformation:SetStackPolicy',
        'cloudformation:TagResource',
        'cloudformation:UntagResource',
        'cloudformation:ValidateTemplate',
      ],
      resources: ['*'],
    }));

    // S3 for CDK asset staging bucket
    this.role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:DeleteObject', 's3:GetBucketLocation', 's3:GetEncryptionConfiguration',
        's3:GetObject', 's3:ListBucket', 's3:PutObject',
      ],
      resources: ['*'],
    }));

    // SSM for CDK bootstrap parameter lookup
    this.role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ssm:GetParameter'],
      resources: [`arn:aws:ssm:us-east-1:${cdk.Aws.ACCOUNT_ID}:parameter/cdk-bootstrap/*`],
    }));

    // STS: assume CDK bootstrap roles only (cdk-* naming convention)
    this.role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['sts:AssumeRole'],
      resources: [`arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/cdk-*`],
    }));

    // IAM for CDK to create Lambda/resource execution roles.
    // Scoped to CDK-generated stack prefixes — prevents privilege escalation via CreateRole+AttachRolePolicy.
    this.role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'iam:AttachRolePolicy', 'iam:CreateRole', 'iam:DeleteRole',
        'iam:DeleteRolePolicy', 'iam:DetachRolePolicy', 'iam:GetRole',
        'iam:GetRolePolicy', 'iam:PassRole', 'iam:PutRolePolicy', 'iam:TagRole',
      ],
      resources: [
        `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/HorizonDevStack-*`,
        `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/HorizonProdStack-*`,
        `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/cdk-*`,
      ],
    }));

    // ECR for Lambda container images
    this.role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecr:BatchCheckLayerAvailability', 'ecr:CompleteLayerUpload',
        'ecr:CreateRepository', 'ecr:DeleteRepository', 'ecr:DescribeRepositories',
        'ecr:GetAuthorizationToken', 'ecr:GetDownloadUrlForLayer',
        'ecr:InitiateLayerUpload', 'ecr:PutImage', 'ecr:TagResource', 'ecr:UploadLayerPart',
      ],
      resources: ['*'],
    }));

    // Lambda function deployment
    this.role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'lambda:AddPermission', 'lambda:CreateAlias', 'lambda:CreateFunction',
        'lambda:DeleteAlias', 'lambda:DeleteFunction', 'lambda:GetFunction',
        'lambda:GetFunctionConfiguration', 'lambda:GetPolicy',
        'lambda:PublishVersion', 'lambda:RemovePermission', 'lambda:TagResource',
        'lambda:UntagResource', 'lambda:UpdateAlias', 'lambda:UpdateFunctionCode',
        'lambda:UpdateFunctionConfiguration',
      ],
      resources: ['*'],
    }));

    // DynamoDB table management
    this.role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:CreateTable', 'dynamodb:DeleteTable', 'dynamodb:DescribeContinuousBackups',
        'dynamodb:DescribeTable', 'dynamodb:DescribeTimeToLive', 'dynamodb:ListTagsOfResource',
        'dynamodb:TagResource', 'dynamodb:UntagResource',
        'dynamodb:UpdateContinuousBackups', 'dynamodb:UpdateTable', 'dynamodb:UpdateTimeToLive',
      ],
      resources: ['*'],
    }));

    // SQS queue management
    this.role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'sqs:CreateQueue', 'sqs:DeleteQueue', 'sqs:GetQueueAttributes',
        'sqs:SetQueueAttributes', 'sqs:TagQueue', 'sqs:UntagQueue',
      ],
      resources: ['*'],
    }));

    // EventBridge rule management
    this.role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'events:DeleteRule', 'events:DescribeRule', 'events:PutRule',
        'events:PutTargets', 'events:RemoveTargets', 'events:TagResource', 'events:UntagResource',
      ],
      resources: ['*'],
    }));

    // CloudWatch Logs — log group lifecycle only (no log data read/write)
    this.role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup', 'logs:DeleteLogGroup', 'logs:DeleteRetentionPolicy',
        'logs:DescribeLogGroups', 'logs:PutRetentionPolicy',
        'logs:TagResource', 'logs:UntagResource',
      ],
      resources: ['*'],
    }));

    // Secrets Manager — lifecycle actions for secrets managed by CDK stacks
    this.role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:CreateSecret', 'secretsmanager:DeleteSecret',
        'secretsmanager:DescribeSecret', 'secretsmanager:GetSecretValue',
        'secretsmanager:TagResource', 'secretsmanager:UntagResource',
      ],
      resources: ['*'],
    }));

    new cdk.CfnOutput(this, 'GitHubActionsRoleArn', {
      value: this.role.roleArn,
      description: 'Add this as the AWS_ROLE_ARN GitHub Actions variable (not a secret)',
      exportName: 'GitHubActionsRoleArn',
    });
  }
}
