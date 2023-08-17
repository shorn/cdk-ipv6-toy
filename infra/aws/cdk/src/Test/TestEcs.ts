import {Construct} from 'constructs';
import {InstanceType, Vpc} from 'aws-cdk-lib/aws-ec2';
import {
  Cluster,
  ContainerImage,
  Ec2Service,
  Ec2TaskDefinition
} from 'aws-cdk-lib/aws-ecs';
import {
  DnsRecordType,
  PublicDnsNamespace
} from 'aws-cdk-lib/aws-servicediscovery';
import * as cdk from 'aws-cdk-lib';

// not yet got this working
export class TestEcs extends Construct {
  constructor(scope: Construct, id: string, props: {
    vpc: Vpc,
  }) {
    super(scope, id);

    const cluster = new Cluster(this, 'EcsCluster', {vpc: props.vpc});
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