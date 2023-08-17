import {Construct} from 'constructs';
import {ManagedPolicy, Role, ServicePrincipal} from 'aws-cdk-lib/aws-iam';
import {
  AmazonLinux2023ImageSsmParameter,
  AmazonLinux2023Kernel,
  Instance,
  InstanceClass,
  InstanceSize,
  InstanceType,
  Port,
  SecurityGroup
} from 'aws-cdk-lib/aws-ec2';
import {Ec2InstanceConnectEndpoint} from '../Shared/Ec2InstanceConnectEndpoint';
import {TestIpV6Vpc} from './TestIpV6Vpc';

export class TestEc2Instance extends Construct {

  constructor(scope: Construct, id: string, props: {
    vpc: TestIpV6Vpc,
    ec2Connect: Ec2InstanceConnectEndpoint
  }) {
    super(scope, id);


    // Create an IAM Role for the EC2 instance
    const instanceRole = new Role(this, 'InstanceRole', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
    });

    // Attach the necessary policy for SSM
    instanceRole.addManagedPolicy(
      /* Allows you to connect to the instance via SSM connect, do:
      right click / connect / session manager / connect
      It's like SSHing in to your instance, but using AWS SSM and IAM to
      authorize, instead of having to create an SSH keypair (and also,
      no bastion, no port 22 rules need to be allowed!). */
      ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      /* note: role is stuff you want to do from the EC2 instance, for stuff
      you want to do from the *task*, you need to modify the ECS.taskRole. */

    );

    instanceRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEC2RoleforSSM')
    );

    // Create a Security Group for the EC2 instance
    const securityGroup = new SecurityGroup(this, 'InstanceSG', {
      vpc: props.vpc,
      description: 'Allow SSM traffic',
      allowAllOutbound: true,   // Allow all outbound traffic by default
      allowAllIpv6Outbound: true,
    });

    // securityGroup.addIngressRule(Peer.ipv4(props.vpc.vpcCidrBlock), Port.allTraffic());
    // securityGroup.addIngressRule(Peer.ipv6(props.vpc.cfnVpcCidrBlock.ipv6CidrBlock!), Port.allTraffic());

    securityGroup.addIngressRule(
      props.ec2Connect.securityGroup,
      Port.tcp(22),
      'Allow SSH from Ec2 connect'
    );

    // Launch the EC2 instance
    new Instance(this, 'TestInstance', {
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      machineImage: new AmazonLinux2023ImageSsmParameter({
        kernel: AmazonLinux2023Kernel.KERNEL_6_1,
      }),
      vpc: props.vpc,
      role: instanceRole,
      securityGroup: securityGroup,
      vpcSubnets: props.vpc.selectSubnets(
        {subnetGroupName: TestIpV6Vpc.privateDualSubnetName})
    });
  }
}

