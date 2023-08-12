import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {SecureStringSsmParam} from './Shared/SecureStringSsmParam';

export class SharedStatelessStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


    new SecureStringSsmParam(this, "testString", "testString");
  }
}
