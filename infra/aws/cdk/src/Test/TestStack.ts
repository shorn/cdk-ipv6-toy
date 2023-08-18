import {Stack, StackProps} from 'aws-cdk-lib';
import {TestIpV6Vpc} from './TestIpV6Vpc';
import {Ec2InstanceConnectEndpoint} from '../Shared/Ec2InstanceConnectEndpoint';
import {Construct} from 'constructs';
import {TestEcs, TestEcsClusterAsg} from './TestEcs';

export function createTestStacks(
  scope: Construct,
  sharedProps?: StackProps
){

  const network = new Stack(scope, 'Network', sharedProps);
  const vpc = new TestIpV6Vpc(network, 'TestIpv6');
  const ec2Connect = new Ec2InstanceConnectEndpoint(
    network, 'TestEc2InstanceConnect', {vpc}
  );

  const sharedStateless = new Stack(scope, 'SharedStateless', sharedProps);
  const ecsClusterAsg = new TestEcsClusterAsg(sharedStateless, 'TestEcsClusterAsg', {
    vpc,
  });
  const ecs = new TestEcs(sharedStateless, 'TestEcs', {
    vpc,
    ecsClusterAsg
  });

// *****   these cost money   ******
// const alb = new TestAlb(sharedStateless, 'TestAlb', {vpc: props.vpc});
// const testEc2 = new TestEc2Instance(sharedStateless, "TestEc2",{
//   vpc: testVpc, ec2Connect
// });



}