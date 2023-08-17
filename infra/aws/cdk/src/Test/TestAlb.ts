import {Construct} from 'constructs';
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
  DesyncMitigationMode,
  IpAddressType,
  ListenerAction,
  ListenerCondition
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import {SecurityGroup} from 'aws-cdk-lib/aws-ec2';
import {Duration} from 'aws-cdk-lib';
import {TestIpV6Vpc} from './TestIpV6Vpc';

// reckon this ought to sub-class ALB, the way the VPC construct does
export class TestAlb extends Construct {
  readonly alb: ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: {
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