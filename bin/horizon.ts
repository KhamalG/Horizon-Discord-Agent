#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { HorizonDevStack, HorizonProdStack } from '../lib/horizon-stack';
import { GitHubOidcStack } from '../lib/github-oidc-stack';

const app = new cdk.App();
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

new HorizonDevStack(app, 'HorizonDevStack', { envName: 'dev', env });
new HorizonProdStack(app, 'HorizonProdStack', { envName: 'prod', env });

// One-time bootstrap stack — deploy manually once, then the CI pipeline self-sustains.
// `npx cdk deploy GitHubOidcStack`
new GitHubOidcStack(app, 'GitHubOidcStack', {
  env,
  githubOrg: 'KhamalG',
  githubRepo: 'Horizon-Discord-Agent',
});
