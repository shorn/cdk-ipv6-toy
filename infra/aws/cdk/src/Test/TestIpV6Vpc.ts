import {
  CfnEgressOnlyInternetGateway, CfnSubnet,
  CfnVPCCidrBlock, ISubnet,
  RouterType, Subnet,
  SubnetType,
  Vpc,
  VpcProps
} from 'aws-cdk-lib/aws-ec2';
import {Construct} from 'constructs';
import {Fn, Stack} from 'aws-cdk-lib';

export class TestIpV6Vpc extends Vpc {

  readonly egressOnlyInternetGatewayId: string;

  readonly primaryAz: string;
  readonly secondaryAz: string;

  static publicDualSubnetName = 'publicDualStack';
  static publicIv6SubnetName = 'publicIpv6Only';
  static privateDualSubnetName = 'privateDualStack';
  static privateIpv6SubnetName = 'privateIpv6Only';
  static isolatedDualSubnetName = 'isolatedDualStack';
  static isolatedIpv6SubnetName = 'isolatedIpv6Only';

  readonly cfnVpcCidrBlock: CfnVPCCidrBlock;

  constructor(scope: Construct, id: string, props?: VpcProps) {
    super(scope, id, {
      vpcName: 'test',
      natGateways: 0,


      // wanted to use just one AZ for cost, but an ALB must use two AZ
      availabilityZones: [
        Stack.of(scope).region + "a",
        Stack.of(scope).region + "b",
      ],

      reservedAzs: 1,

      enableDnsHostnames: true,
      enableDnsSupport: true,

      restrictDefaultSecurityGroup: true,
      createInternetGateway: true,

      subnetConfiguration: [
        {
          name: TestIpV6Vpc.publicDualSubnetName,
          subnetType: SubnetType.PUBLIC,
          mapPublicIpOnLaunch: true,
        },
        {
          name: TestIpV6Vpc.publicIv6SubnetName,
          subnetType: SubnetType.PUBLIC,
          mapPublicIpOnLaunch: false,
        },
        {
          name: TestIpV6Vpc.privateDualSubnetName,
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          name: TestIpV6Vpc.privateIpv6SubnetName,
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          name: TestIpV6Vpc.isolatedDualSubnetName,
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
        {
          name: TestIpV6Vpc.isolatedIpv6SubnetName,
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    this.primaryAz = this.availabilityZones[0];
    this.secondaryAz = this.availabilityZones[1];

    // make all the subnets support ipv6
    this.cfnVpcCidrBlock = modifyForIpv6(this, [
      ...this.publicSubnets,
      ...this.privateSubnets,
      ...this.isolatedSubnets,
    ]);

    // make these ones "ipv6 only"
    modifyForIpv6Only([
      ...this.selectNamedSubnets(TestIpV6Vpc.publicIv6SubnetName),
      ...this.selectNamedSubnets(TestIpV6Vpc.privateIpv6SubnetName),
      ...this.selectNamedSubnets(TestIpV6Vpc.isolatedIpv6SubnetName),
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
      this, "EgressOnlyIGW", {vpcId: this.vpcId}
    );
    this.egressOnlyInternetGatewayId = egressIgw.ref;

    // for private subnets, create route to an EgressOnlyIGW
    addDefaultIpv6Routes(
      this.privateSubnets,
      egressIgw.ref,
      RouterType.EGRESS_ONLY_INTERNET_GATEWAY
    );

    /* force export resources to avoid errors about deleting exports when
    frobbing resources in other stacks that use the VPC (ALBs, EC2 instances) */
    Stack.of(this).exportValue(this.vpcId);
    Stack.of(this).exportValue(this.vpcCidrBlock);
    this.selectSubnets().subnets.forEach(iSubnet => {
      Stack.of(this).exportValue(iSubnet.subnetId)
    });
  }

  public selectNamedSubnets(subnetGroupName: string) {
    return this.selectSubnets({subnetGroupName}).subnets;
  }

}

/**
 * Creates a /54 CIDR, then sequentially allocates one /64 cidr from it for
 * each iven Subnet.
 */
function modifyForIpv6(vpc: Vpc, subnets: ISubnet[]): CfnVPCCidrBlock {
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
