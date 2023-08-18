import {Construct} from 'constructs';
import {SecurityGroup} from 'aws-cdk-lib/aws-ec2';

import {TestIpV6Vpc} from '../Test/TestIpV6Vpc';
import {Stack} from 'aws-cdk-lib';

/**
 * Can't create an Ec2 connection endpoint (a "VPC Endpoint") via code yet,
 * but you need to have a SecGroup that it's attached to via the manual process,
 * so we can then allow that SecGroup to have access to instances.
 *
 * @see https://github.com/aws/aws-cdk/issues/26226
 * https://github.com/aws-cloudformation/cloudformation-coverage-roadmap/issues/1749
 */
export class Ec2InstanceConnectEndpoint extends Construct {
  readonly securityGroup: SecurityGroup;

  constructor(scope: Construct, id: string, props: {
    vpc: TestIpV6Vpc,
  }) {
    super(scope, id);

    /* Create a Security Group for the endpoint, remember that you'll need
    to manually delete the VPC endpoint before you can delete this SG.
    CloudFormation just sits waiting for you to detach the SG from endpoint. */
    this.securityGroup = new SecurityGroup(this, 'Ec2Connect', {
      securityGroupName: "Ec2Connect",
      vpc: props.vpc,
      description: 'Allow SSM traffic',
      allowAllOutbound: true,   // Allow all outbound traffic by default
      allowAllIpv6Outbound: true,
    });

    Stack.of(this).exportValue(this.securityGroup.securityGroupId);

  }
}
