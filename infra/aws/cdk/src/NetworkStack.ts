import {
  CfnEgressOnlyInternetGateway,
  CfnSubnet,
  CfnVPCCidrBlock,
  ISubnet,
  RouterType,
  Subnet,
  SubnetType,
  Vpc,
  VpcProps
} from "aws-cdk-lib/aws-ec2";
import {Construct} from "constructs";
import {Fn, Stack, StackProps} from 'aws-cdk-lib';


export class NetworkStack extends Stack {
  readonly testVpc: TestIpV6Vpc;

  constructor(scope: Construct, id: string, props?: StackProps){
    super(scope, id, props);

    this.testVpc = new TestIpV6Vpc(this, 'TestIpv6');
  }
}

export class TestIpV6Vpc extends Vpc {
  readonly egressOnlyInternetGatewayId: string;

  readonly primaryAz: string;
  readonly secondaryAz: string;

  // readonly vpc: Vpc;

  readonly publicDualSubnets: ISubnet[];
  readonly publicIpv6Subnets: ISubnet[];
  readonly privateDualSubnets: ISubnet[];
  readonly privateIpv6Subnets: ISubnet[];
  readonly isolatedDualSubnets: ISubnet[];
  readonly isolatedIpv6Subnets: ISubnet[];


  readonly cfnVpcCidrBlock: CfnVPCCidrBlock;

  constructor(scope: Construct, id: string, props?: VpcProps) {
    super(scope, id, {
      vpcName: 'test',
      natGateways: 0,

      // wanted to use just one AZ for cost, but an ALB must use two AZ
      availabilityZones: [
        Stack.of(scope).region+"a",
        Stack.of(scope).region+"b",
      ],

      reservedAzs: 1,

      enableDnsHostnames: true,
      enableDnsSupport: true,

      restrictDefaultSecurityGroup: true,
      createInternetGateway: true,

      subnetConfiguration: [
        {
          name: 'publicDualStack',
          subnetType: SubnetType.PUBLIC,
          mapPublicIpOnLaunch: true,
        },
        {
          name: 'publicIpv6Only',
          subnetType: SubnetType.PUBLIC,
          mapPublicIpOnLaunch: false,
        },
        {
          name: 'privateDualStack',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          name: 'privateIpv6Only',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          name: 'isolatedDualStack',
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
        {
          name: 'isolatedIpv6Only',
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    this.primaryAz = this.availabilityZones[0];
    this.secondaryAz = this.availabilityZones[1];

    this.publicDualSubnets = this.selectNamedSubnets('publicDualStack');
    this.publicIpv6Subnets = this.selectNamedSubnets('publicIpv6Only');
    this.privateDualSubnets = this.selectNamedSubnets('privateDualStack');
    this.privateIpv6Subnets = this.selectNamedSubnets('privateIpv6Only');
    this.isolatedDualSubnets = this.selectNamedSubnets('isolatedDualStack');
    this.isolatedIpv6Subnets = this.selectNamedSubnets('isolatedIpv6Only');

    this.cfnVpcCidrBlock = modifySubnetsForIpv6(this, [
      ...this.publicSubnets,
      ...this.privateSubnets,
      ...this.isolatedSubnets,
    ]);

    modifyForIpv6Only([
      ...this.publicIpv6Subnets,
      ...this.privateIpv6Subnets,
      ...this.isolatedIpv6Subnets,
    ]);

    // for public subnets, create route to the internet gateway
    if (this.internetGatewayId) {
      addDefaultIpv6Routes(
        this.publicSubnets,
        this.internetGatewayId,
        RouterType.GATEWAY
      );
    }

    const egressIgw = new CfnEgressOnlyInternetGateway(
      this, "EgressOnlyIGW", { vpcId: this.vpcId }
    );
    this.egressOnlyInternetGatewayId = egressIgw.ref;

    // for private subnets, create route to an EgressOnlyIGW
    addDefaultIpv6Routes(
      this.privateSubnets,
      egressIgw.ref,
      RouterType.EGRESS_ONLY_INTERNET_GATEWAY
    );

  }

  private selectNamedSubnets(subnetGroupName: string){
    return this.selectSubnets({subnetGroupName}).subnets;
  }

}

/**
 * Creates a /54 CIDR, then sequentially allocates one /64 cidr from it for
 * each iven Subnet.
 */
function modifySubnetsForIpv6(vpc: Vpc, subnets: ISubnet[]): CfnVPCCidrBlock {
  // associate an IPv6 ::/56 CIDR block with our vpc
  const cfnVpcCidrBlock = new CfnVPCCidrBlock(vpc, "Ipv6Cidr", {
    vpcId: vpc.vpcId,
    amazonProvidedIpv6CidrBlock: true,
  });
  const vpcIpv6CidrBlock = Fn.select(0, vpc.vpcIpv6CidrBlocks);

  // slice our ::/56 CIDR block into 256 chunks of ::/64 CIDRs
  const subnetIpv6CidrBlocks = Fn.cidr(vpcIpv6CidrBlock, 256, "64");

  // associate an IPv6 CIDR sub-block to each subnet
  subnets.forEach((iSubnet, subnetIndex) => {
    /* Since we're doing L1 stuff to the subnet and VPC, we have to manually
     setup the dependency between the vpc ipv6 CIDR block and the subnet, or
     CDK might try and do the subnet stuff before the ipv6 CIDR block is
     configured. */
    iSubnet.node.addDependency(cfnVpcCidrBlock);

    const iCfnSubnet = iSubnet.node.defaultChild as CfnSubnet;
    iCfnSubnet.ipv6CidrBlock = Fn.select(subnetIndex, subnetIpv6CidrBlocks);
    iCfnSubnet.assignIpv6AddressOnCreation = true;
  });

  return cfnVpcCidrBlock;
}

function modifyForIpv6Only(subnets: ISubnet[]) {
  subnets.forEach(iSubnet=>{
    const iCfnSubnet = iSubnet.node.defaultChild as CfnSubnet;
    iCfnSubnet.ipv6Native = true;
    iCfnSubnet.cidrBlock = undefined;
    iCfnSubnet.mapPublicIpOnLaunch = false;
  });
}

function addDefaultIpv6Routes(
  subnets: ISubnet[],
  gatewayId: string,
  routerType: RouterType
) {
  subnets.forEach((subnet) =>
    (subnet as Subnet).addRoute("Default6Route", {
      routerType: routerType,
      routerId: gatewayId,
      destinationIpv6CidrBlock: "::/0",
      enablesInternetConnectivity: true,
    })
  );
}
