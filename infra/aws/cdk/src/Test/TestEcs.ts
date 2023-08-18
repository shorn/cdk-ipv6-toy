import {Construct} from 'constructs';
import {
  InstanceClass,
  InstanceSize,
  InstanceType,
  LaunchTemplate,
  SecurityGroup,
  Vpc
} from 'aws-cdk-lib/aws-ec2';
import {
  AsgCapacityProvider,
  BuiltInAttributes,
  Cluster,
  ContainerImage,
  Ec2Service,
  Ec2TaskDefinition,
  EcsOptimizedImage, LogDriver,
  NetworkMode,
  PlacementStrategy,
  Protocol, Scope
} from 'aws-cdk-lib/aws-ecs';
import * as cdk from 'aws-cdk-lib';
import {Duration, RemovalPolicy, Stack} from 'aws-cdk-lib';
import {AutoScalingGroup} from 'aws-cdk-lib/aws-autoscaling';
import {ManagedPolicy, Role, ServicePrincipal} from 'aws-cdk-lib/aws-iam';
import {TestIpV6Vpc} from './TestIpV6Vpc';
import {LogGroup, RetentionDays} from 'aws-cdk-lib/aws-logs';

// not yet got this working

export class TestEcsClusterAsg extends Construct {
  readonly asg: AutoScalingGroup;
  readonly cluster: Cluster;
  readonly capacityProvider: AsgCapacityProvider;
  readonly securityGroup: SecurityGroup;

  constructor(scope: Construct, id: string, props: {
    vpc: Vpc,
  }){
    super(scope, id);

    /* Create a Security Group for the endpoint, remember that you'll need
    to manually delete the VPC endpoint before you can delete this SG.
    CloudFormation just sits waiting for you to detach the SG from endpoint. */
    this.securityGroup = new SecurityGroup(this, 'SecurityGroup', {
      vpc: props.vpc,
      description: 'TestEcsClusterAsgInstance',
      allowAllOutbound: true,   // Allow all outbound traffic by default
      allowAllIpv6Outbound: true,
    });

    const role = new Role(this, 'Role', {
      // no roleName to allow easy replacement
      description: "for the LaunchTemplate used by the ECS ASG",
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        /* Note: won't work, SSM needs public IPv4 connectivity */
        ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    const launchTemplate = new LaunchTemplate(this, 'LaunchTemplate', {
      machineImage: EcsOptimizedImage.amazonLinux2(),
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      role: role,
      securityGroup: this.securityGroup,
      // userData: UserData.forLinux(),
    });


    this.asg = new AutoScalingGroup(this, 'Asg', {
      autoScalingGroupName: "TestEcs",

      vpc: props.vpc,
      // vpcSubnets: props.vpc.selectSubnets(
      //   {subnetGroupName: TestIpV6Vpc.privateDualNatSubnetName}),
      vpcSubnets: props.vpc.selectSubnets(
        {subnetGroupName: TestIpV6Vpc.privateDualSubnetName}),

      launchTemplate: launchTemplate,

      /* costs money, start at 0 */
      // desiredCapacity: 0,

      minCapacity: 0,
      maxCapacity: 2,

    });

    this.cluster = new Cluster(this, 'Cluster', {
      clusterName: "TestCluster",
      vpc: props.vpc,
    });

    this.capacityProvider = new AsgCapacityProvider(
      this, 'CapProvider', {
        autoScalingGroup: this.asg,
        enableManagedScaling: true,
        enableManagedTerminationProtection: false,
      });

    this.cluster.addAsgCapacityProvider(this.capacityProvider);

  }
}

export class TestEcs extends Construct {
  readonly ec2Service: Ec2Service;
  // readonly ecr: Repository;

  readonly desiredCount: number = 0;

  constructor(scope: Construct, id: string, props: cdk.StackProps & {
    vpc: Vpc,
    ecsClusterAsg: TestEcsClusterAsg,
  }){
    super(scope, id);

    // this.ecr = new Repository(this, 'Ecr', {
    //   repositoryName: "test-ecs",
    //   removalPolicy: RemovalPolicy.DESTROY,
    // });

    const logGroup = new LogGroup(this, "Log", {
      logGroupName: "TestEcs",
      retention: RetentionDays.THREE_MONTHS,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const taskDefinition = new Ec2TaskDefinition(this, 'TaskDef', {
      networkMode: NetworkMode.BRIDGE,
    });

    const container = taskDefinition.addContainer('Container', {
      containerName: 'test-ecs',
      essential: true,
      privileged: false,
      memoryLimitMiB: 600,
      stopTimeout: Duration.seconds(30),
      // image: ContainerImage.fromRegistry('nginxdemos/hello:plain-text'),
      image: ContainerImage.fromRegistry('registry.ipv6.docker.com/nginxdemos/hello:plain-text'),
      // image: ContainerImage.fromEcrRepository(
      //   this.ecr,
      //   ''
      // ),
      healthCheck: {
        command: [
          "CMD-SHELL",
          // any url will do, the hello container responds to all
          "curl -f http://localhost:80/status || exit 1" ],
        interval: Duration.seconds(5),
        startPeriod: Duration.seconds(10),
        retries: 5,
        timeout: Duration.seconds(5),
      },
      logging: LogDriver.awsLogs({
        logGroup: logGroup,
        /* log streams end up looking like
        "<logGroup.name>/<streamPrefix>/<container name>/<container id>" */
        streamPrefix: "task",
      }),

    });

    container.addPortMappings({
      /* hostPort is undefined, because we use "bridge" network mode, the
       containers will be assigned randomly in the ephemeral port range */
      containerPort: 80,
      protocol: Protocol.TCP
    });

    this.ec2Service = new Ec2Service(this, 'Service', {
      serviceName: "test-ecs",
      cluster: props.ecsClusterAsg.cluster,
      taskDefinition,

      // allow to connect directly to container, see /doc/ecs-ssh-connection.md)
      // won't work without public IPv4 connectivity
      enableExecuteCommand: true,

      placementStrategies: [PlacementStrategy.spreadAcross(
        BuiltInAttributes.INSTANCE_ID )],
      desiredCount: this.desiredCount,
      minHealthyPercent: 0,

      capacityProviderStrategies: [{
        capacityProvider:
          props.ecsClusterAsg.capacityProvider.capacityProviderName,
        weight: 1,
      }],
    });

  }
}
