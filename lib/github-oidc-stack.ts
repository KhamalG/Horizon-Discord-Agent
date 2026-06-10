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
    // Thumbprint list from https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc_verify-thumbprint.html
    const provider = new iam.OpenIdConnectProvider(this, 'GitHubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
      thumbprints: [
        '6938fd4d98bab03faadb97b34396831e3780aea1',
        '1c58a3a8518e8759bf075b6d5f19e45c0b379873',
      ],
    });

    // Trust policy: only the specific repo, and only main/dev branches + PRs.
    // The `sub` claim for a branch push is:  repo:<org>/<repo>:ref:refs/heads/<branch>
    // The `sub` claim for a PR run is:       repo:<org>/<repo>:pull_request
    const conditions: iam.Conditions = {
      StringLike: {
        'token.actions.githubusercontent.com:sub': [
          `repo:${githubOrg}/${githubRepo}:ref:refs/heads/main`,
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
      description: `Assumed by GitHub Actions for ${githubOrg}/${githubRepo} (main, dev, PRs)`,
    });

    // Minimum permissions for CDK deploy (CloudFormation, S3, IAM, and service-specific).
    // Scoped to specific repo + branch via OIDC trust policy — not by resource ARN.
    // Post-launch: tighten to specific CloudFormation stack ARNs and S3 bucket ARNs.
    this.role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cloudformation:*',
          's3:*',
          'ssm:GetParameter',
          'sts:AssumeRole',
          'iam:PassRole',
          'iam:CreateRole',
          'iam:AttachRolePolicy',
          'iam:DetachRolePolicy',
          'iam:DeleteRole',
          'iam:GetRole',
          'iam:TagRole',
          'iam:PutRolePolicy',
          'iam:DeleteRolePolicy',
          'iam:GetRolePolicy',
          'ecr:*',
          'lambda:*',
          'dynamodb:*',
          'sqs:*',
          'events:*',
          'logs:*',
          'secretsmanager:*',
        ],
        resources: ['*'],
      }),
    );

    new cdk.CfnOutput(this, 'GitHubActionsRoleArn', {
      value: this.role.roleArn,
      description: 'Add this as the AWS_ROLE_ARN GitHub Actions variable (not a secret)',
      exportName: 'GitHubActionsRoleArn',
    });
  }
}
