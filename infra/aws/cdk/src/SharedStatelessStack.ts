import * as cdk from 'aws-cdk-lib';
import {Duration, Fn} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
  DesyncMitigationMode,
  IpAddressType,
  ListenerAction,
  ListenerCondition
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import {
  AmazonLinux2023ImageSsmParameter,
  AmazonLinux2023Kernel,
  AmazonLinuxImage,
  Instance, InstanceClass, InstanceSize,
  InstanceType,
  Peer, Port,
  SecurityGroup,
  Subnet,
  Vpc
} from 'aws-cdk-lib/aws-ec2';
import {
  DnsRecordType,
  PublicDnsNamespace
} from 'aws-cdk-lib/aws-servicediscovery';
import {
  Cluster,
  ContainerImage,
  Ec2Service,
  Ec2TaskDefinition
} from 'aws-cdk-lib/aws-ecs';
import {TestIpV6Vpc} from './NetworkStack';
import {ManagedPolicy, Role, ServicePrincipal} from 'aws-cdk-lib/aws-iam';

export class SharedStatelessStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps & {
    vpc: TestIpV6Vpc,
  }) {
    super(scope, id, props);

    // new SecureStringSsmParam(this, "testString", "testString");
    // new TestAlb(this, 'TestAlb', {vpc: props.vpc});

    const ec2Connect = new Ec2InstanceConnectEndpoint(this, "Ec2Connect", {
      vpc: props.vpc
    });
    // new TestEc2(this, "TestEc2",{vpc: props.vpc, ec2Connect});
  }
}

/**
 * Can't create an Ec2 connection endpoint via code yet, but need to have a
 * SecGroup that it's attached to via the manual process, so we can then
 * allow that SecGroup to have access to instances.
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

    // Create a Security Group for the EC2 instance
    this.securityGroup = new SecurityGroup(this, 'InstanceSG', {
      vpc: props.vpc,
      description: 'Allow SSM traffic',
      allowAllOutbound: true,   // Allow all outbound traffic by default
      allowAllIpv6Outbound: true,
    });
  }
}

export class TestEc2 extends Construct {

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

export class TestAlb extends Construct {
  readonly alb: ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props:{
    vpc: TestIpV6Vpc,
  }) {
    super(scope, id);

    const sg = new SecurityGroup(this, `AlbSg`, {
      vpc: props.vpc,
      securityGroupName: `TestAlb`,
      allowAllOutbound: false,
      allowAllIpv6Outbound: true,
    });

    this.alb = new ApplicationLoadBalancer(this, 'Alb', {
      loadBalancerName: 'TestAlb',
      // cdk 2.91.0 - there is only ipv4 or dual-stack
      ipAddressType: IpAddressType.DUAL_STACK,
      internetFacing: true,
      vpc: props.vpc,
      vpcSubnets: {
        onePerAz: true,
        /* Not enough IP space available in subnet-xxx.
         ELB requires at least 8 free IP addresses in each subnet.
        subnets: props.vpc.publicIpv6Subnets, */
        // subnets: props.vpc.publicDualSubnets,
        subnets: props.vpc.selectNamedSubnets(TestIpV6Vpc.publicDualSubnetName),
      },
      /* partly just avoid an ugly auto-gen name, but also because implicitly
      created SecGroups cause issues with x-stack refs. Because the SecGroup was
      implicit, I had no reference to it - hard to do an exportValue(). */
      securityGroup: sg,
      idleTimeout: Duration.seconds(60),
      dropInvalidHeaderFields: false,
      desyncMitigationMode: DesyncMitigationMode.DEFENSIVE,
    });

    const httpListener = this.alb.addListener('AlbListenerHttp', {
      port: 80,
      protocol: ApplicationProtocol.HTTP,
      open: true,
      /* default deny because we don't want the logs filled with
      404 and other errors from internet rando's doing flyby scans. */
      defaultAction: ListenerAction.fixedResponse(404, {
        contentType: 'text/html',
        messageBody: `<h1>Not found</h1><!--${this.alb.loadBalancerName} ALB-->`,
      }),
    });

    /* Useful for diagnosis, can check reachability of ALB, without worrying
    about status of the ASG target group. */
    httpListener.addAction('/alb-ping', {
      priority: 11,
      conditions: [
        ListenerCondition.pathPatterns(['/alb-ping']),
      ],
      action: ListenerAction.fixedResponse(200, {
        contentType: 'text/html',
        messageBody: `<h1>Static ALB Response</h1><!-- ${this.alb.loadBalancerName} ALB  -->`,
      }),
    });

  }
}

export class Ecs extends Construct {
  constructor(scope: Construct, id: string, props: {
    vpc: Vpc,
  }) {
    super(scope, id);

    const cluster = new Cluster(this, 'EcsCluster', { vpc: props.vpc });
    cluster.addCapacity('DefaultAutoScalingGroupCapacity', {
      instanceType: new InstanceType('t4.micro'),
    });


    const taskDefinition = new Ec2TaskDefinition(this, 'TaskDef');
    const container = taskDefinition.addContainer('MyContainer', {
      image: ContainerImage.fromRegistry('nginxdemos/hello:plain-text'),
      memoryLimitMiB: 512,
    });
    container.addPortMappings({
      containerPort: 80,
    });

    const ecsService = new Ec2Service(this, 'Service', {
      cluster,
      taskDefinition,
    });

    const publicNamespace = new PublicDnsNamespace(this, 'PublicNamespace', {
      name: 'cdk-ipv6-toy',
    });

    const serviceDiscoveryService = publicNamespace.createService('ServiceDiscoveryService', {
      description: 'My public service discovery service',
      dnsRecordType: DnsRecordType.AAAA,
      dnsTtl: cdk.Duration.seconds(60),
      loadBalancer: false,
    });


  }
}