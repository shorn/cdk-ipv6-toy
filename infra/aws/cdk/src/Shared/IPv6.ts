import {
  CfnEgressOnlyInternetGateway,
  CfnSubnet,
  CfnVPCCidrBlock,
  Instance,
  InstanceProps,
  ISubnet,
  RouterType,
  SecurityGroup,
  Subnet,
  Vpc,
  VpcProps
} from "aws-cdk-lib/aws-ec2";
import {Construct} from "constructs";
import {Fn, Tags} from 'aws-cdk-lib';

// https://superluminar.io/2023/03/23/ipv6-in-aws-with-cdk/
export class Ipv6Vpc extends Vpc {
  readonly egressOnlyInternetGatewayId: string;

  constructor(scope: Construct, id: string, props?: VpcProps) {
    super(scope, id, props);

    // Tags.of(this).add("Name", this.node.path);

    // associate an IPv6 ::/56 CIDR block with our vpc
    const cfnVpcCidrBlock = new CfnVPCCidrBlock(this, "Ipv6Cidr", {
      vpcId: this.vpcId,
      amazonProvidedIpv6CidrBlock: true,
    });
    const vpcIpv6CidrBlock = Fn.select(0, this.vpcIpv6CidrBlocks);

    // slice our ::/56 CIDR block into 256 chunks of ::/64 CIDRs
    const subnetIpv6CidrBlocks = Fn.cidr(vpcIpv6CidrBlock, 256, "64");

    // associate an IPv6 CIDR sub-block to each subnet
    [
      ...this.publicSubnets,
      ...this.privateSubnets,
      ...this.isolatedSubnets,
    ].forEach((subnet, i) => {
      subnet.node.addDependency(cfnVpcCidrBlock);
      const cfnSubnet = subnet.node.defaultChild as CfnSubnet;
      cfnSubnet.ipv6CidrBlock = Fn.select(i, subnetIpv6CidrBlocks);
      cfnSubnet.assignIpv6AddressOnCreation = true;
    });

    const addDefaultIpv6Routes = (
      subnets: ISubnet[],
      gatewayId: string,
      routerType: RouterType
    ) =>
      subnets.forEach((subnet) =>
        (subnet as Subnet).addRoute("Default6Route", {
          routerType: routerType,
          routerId: gatewayId,
          destinationIpv6CidrBlock: "::/0",
          enablesInternetConnectivity: true,
        })
      );

    // for public subnets, ensure they have a route to the internet gateway
    if (this.internetGatewayId) {
      addDefaultIpv6Routes(
        this.publicSubnets,
        this.internetGatewayId,
        RouterType.GATEWAY
      );
    }

    // for private subnets...
    if (this.privateSubnets.length == 0) {
      return;
    }

    // ...ensure there is an IPv6 egress gateway...
    const egressIgw = new CfnEgressOnlyInternetGateway(
      this, "EgressOnlyIGW", { vpcId: this.vpcId }
    );
    this.egressOnlyInternetGatewayId = egressIgw.ref;

    // ...and ensure they have a route to the egress gateway
    addDefaultIpv6Routes(
      this.privateSubnets,
      egressIgw.ref,
      RouterType.EGRESS_ONLY_INTERNET_GATEWAY
    );
  }
}

class Ipv6Instance extends Instance {
  constructor(scope: Construct, id: string, props: InstanceProps) {
    const securityGroup = props.securityGroup
      ? undefined
      : new SecurityGroup(scope, `${id}:InstanceSecurityGroup`, {
        vpc: props.vpc,
        allowAllOutbound: true,
        allowAllIpv6Outbound: true,
      });

    super(scope, id, { securityGroup, ...props });
    if (securityGroup) {
      Tags.of(securityGroup).add("Name", props.instanceName || this.node.path);
    }
  }
}