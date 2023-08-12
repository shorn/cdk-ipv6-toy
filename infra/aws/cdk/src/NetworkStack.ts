import * as cdk from "aws-cdk-lib";
import {SubnetType, Vpc} from "aws-cdk-lib/aws-ec2";
import {Construct} from "constructs";
import {vpc} from './Shared/Constant';

export class NetworkStack extends cdk.Stack {
  readonly rdsSubnetName = 'rds';
  readonly publicSubnetName = 'public';
  readonly vpc: Vpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps){
    super(scope, id, props);

    this.vpc = new Vpc(this, 'Ipv6ToyTestVpc', {
      vpcName: "test",

      ipAddresses: vpc.testCidr,


      natGateways: 0,

      maxAzs: 1,
      reservedAzs: 2,
      
      enableDnsHostnames: true,
      enableDnsSupport: true,

      restrictDefaultSecurityGroup: true,
      createInternetGateway: true,


      subnetConfiguration: [
        {
          name: this.publicSubnetName,
          subnetType: SubnetType.PUBLIC,
          mapPublicIpOnLaunch: true,
        },
        {
          name: this.rdsSubnetName,
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

  }
}