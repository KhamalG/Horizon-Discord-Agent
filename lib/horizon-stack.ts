import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface HorizonStackProps extends StackProps {
  envName: 'dev' | 'prod';
}

export class HorizonStack extends Stack {
  readonly envName: string;

  constructor(scope: Construct, id: string, props: HorizonStackProps) {
    super(scope, id, {
      ...props,
      stackName: `horizon-${props.envName}`,
    });
    this.envName = props.envName;
  }
}

export class HorizonDevStack extends HorizonStack {}

export class HorizonProdStack extends HorizonStack {}
