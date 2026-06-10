import { Stack, StackProps } from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { StorageConstruct } from './constructs/storage';
import { SecretsConstruct } from './constructs/secrets';
import { IamRolesConstruct } from './constructs/iam-roles';

export interface HorizonStackProps extends StackProps {
  envName: 'dev' | 'prod';
}

export class HorizonStack extends Stack {
  readonly envName: 'dev' | 'prod';
  readonly storage: StorageConstruct;
  readonly secrets: SecretsConstruct;
  readonly iamRoles: IamRolesConstruct;

  constructor(scope: Construct, id: string, props: HorizonStackProps) {
    super(scope, id, {
      ...props,
      stackName: `horizon-${props.envName}`,
    });
    this.envName = props.envName;

    this.storage = new StorageConstruct(this, 'Storage', {
      envName: props.envName,
    });

    // Secrets Manager stubs — placeholders replaced post-deploy via aws secretsmanager put-secret-value
    this.secrets = new SecretsConstruct(this, 'Secrets', {
      envName: props.envName,
    });

    // Three IAM roles with zero write-permission overlap
    this.iamRoles = new IamRolesConstruct(this, 'IamRoles', {
      signalsTableArn: this.storage.signalsTableArn,
      configTableArn: this.storage.configTableArn,
      signalsStreamArn: this.storage.signalsTableStreamArn,
      envName: props.envName,
    });

    // SSM Parameter Store stubs for Discord channel IDs
    this.createSsmParameters();
  }

  private createSsmParameters(): void {
    const channels = [
      { name: 'bot-testing-channel-id', suffix: 'bot-testing-channel-id' },
      { name: 'khamal-analysis-channel-id', suffix: 'khamal-analysis-channel-id' },
    ];
    const envs = ['prod', 'dev'] as const;

    for (const env of envs) {
      for (const channel of channels) {
        new ssm.StringParameter(this, `Ssm${env}${channel.name}`, {
          parameterName: `/horizon/${env}/discord/${channel.suffix}`,
          stringValue: 'PLACEHOLDER',
          description: `Horizon Discord ${channel.name} for ${env} environment`,
        });
      }
    }
  }
}

export class HorizonDevStack extends HorizonStack {}

export class HorizonProdStack extends HorizonStack {}
