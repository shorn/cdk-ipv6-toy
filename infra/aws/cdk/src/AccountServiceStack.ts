import * as cdk from "aws-cdk-lib";
import {Construct} from "constructs";
import {CloudTrail} from './Shared/CloudTrail';

export class AccountServiceStack extends cdk.Stack {
  readonly cloudTrail: CloudTrail;

  constructor(scope: Construct, id: string, props?: cdk.StackProps){
    super(scope, id, props);

    this.cloudTrail = new CloudTrail(this, 'CloudTrail');
  }
}