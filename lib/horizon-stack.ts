import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StorageConstruct } from './constructs/storage';

export interface HorizonStackProps extends StackProps {
  envName: 'dev' | 'prod';
}

export class HorizonStack extends Stack {
  readonly envName: 'dev' | 'prod';
  readonly storage: StorageConstruct;

  constructor(scope: Construct, id: string, props: HorizonStackProps) {
    super(scope, id, {
      ...props,
      stackName: `horizon-${props.envName}`,
    });
    this.envName = props.envName;

    this.storage = new StorageConstruct(this, 'Storage', {
      envName: props.envName,
    });
  }
}

export class HorizonDevStack extends HorizonStack {}

export class HorizonProdStack extends HorizonStack {}
