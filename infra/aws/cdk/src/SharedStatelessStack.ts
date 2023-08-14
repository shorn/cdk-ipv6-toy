import * as cdk from 'aws-cdk-lib';
import {Duration} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
  DesyncMitigationMode,
  IpAddressType,
  ListenerAction,
  ListenerCondition
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import {InstanceType, SecurityGroup, Vpc} from 'aws-cdk-lib/aws-ec2';
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

export class SharedStatelessStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps & {
    vpc: TestIpV6Vpc,
  }) {
    super(scope, id, props);

    new TestAlb(this, 'TestAlb', {vpc: props.vpc});

    // new SecureStringSsmParam(this, "testString", "testString");
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
      vpc: props.vpc,
      internetFacing: true,
      vpcSubnets: {
        onePerAz: true,
        /* Not enough IP space available in subnet-xxx.
         ELB requires at least 8 free IP addresses in each subnet. */
        // subnets: props.vpc.publicIpv6Subnets,
        subnets: props.vpc.publicDualSubnets,
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