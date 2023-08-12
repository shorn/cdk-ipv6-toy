import {ISubnet, SubnetType, Vpc} from "aws-cdk-lib/aws-ec2";
import {Construct} from "constructs";
import {Stack, StackProps} from 'aws-cdk-lib';
import {Ipv6Vpc} from './Shared/IPv6';

export class NetworkStack extends Stack {
  readonly availabilityZone: string;

  readonly testVpc: Vpc;
  readonly testPublicSubnet: ISubnet;
  readonly testPrivateSubnet: ISubnet;
  readonly testRdsSubnet: ISubnet;

  constructor(scope: Construct, id: string, props?: StackProps){
    super(scope, id, props);

    this.availabilityZone = this.region + 'a';

    this.testVpc = new Ipv6Vpc(this, 'Ipv6ToyTestVpc', {
      vpcName: 'test',

      natGateways: 0,

      maxAzs: 1,
      reservedAzs: 2,
      
      enableDnsHostnames: true,
      enableDnsSupport: true,

      restrictDefaultSecurityGroup: true,
      createInternetGateway: true,

      subnetConfiguration: [
        {
          name: 'public',
          subnetType: SubnetType.PUBLIC,
          mapPublicIpOnLaunch: true,

        },
        {
          name: 'private',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          name: 'rds',
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });
    this.testPublicSubnet = this.testVpc.publicSubnets[0];
    this.testRdsSubnet = this.testVpc.isolatedSubnets[0];
    this.testPrivateSubnet = this.testVpc.privateSubnets[0];

  }
}

