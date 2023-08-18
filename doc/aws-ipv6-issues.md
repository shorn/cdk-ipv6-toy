As at 2023-08-14.

Note that my personal perspective when researching this stuff is cost-first, 
not security-first. 

This repo was created out of my desire to research ways to use IPv6 to avoid
the new IPv4 public address charges.

### The ipv6 support page does not list all services that do not support IPv6

For example, the SSM is not listed on the 
[VPC IPv6 support page](https://docs.aws.amazon.com/vpc/latest/userguide/aws-ipv6-support.html).


### You CAN create an ipv6-only subnet using CDK

But you have to use [L1 constructs](https://docs.aws.amazon.com/cdk/v2/guide/cfn_layer.html),
see [TestIpV6Vpc.ts](/infra/aws/cdk/src/Test/TestIpV6Vpc.ts)

But they're not much use, since most AWS services don't support IPv6 connections
so your private subnets will need private IPv4 support and some form of NAT.

You might be able to create an IPv6 only subnet with a bunch of VPC interface 
endpoints; but those will likely end up costing you similar or more to NAT +
public IPv4 addresses anyway, so I didn't bother with it.


### You CAN create an EC2 instance in an IPv6 subnet without public IPv4

[TestEc2Instance.ts](/infra/aws/cdk/src/Test/TestEc2Instance.ts)

This uses Linux 2023, you can do `sudo dnf update`, `sudo dnf install` and it
works fine with IPv6.  At least, it's in a dual-stack subnet with no NAT, so it
seems fine.


### You CANNOT create an ipv6-only vpc

Looks like there's currently no such thing.


### You CANNOT create an ALB in a single AZ

Not so much an IPv6 thing, as just something I wanted try - to reduce
ipv4 address costs and inter-AZ network costs


### You CANNOT create an IPv6-only ALB

If you create an ALB with one of it's subnets being ipv6-only, you will get:

> Not enough IP space available in subnet-xxx. 
> ELB requires at least 8 free IP addresses in each subnet.


### You CANNOT use the free-tier instance type with IPv6

`IPv6 addresses are not supported on t2.micro`


### You CANNOT use EC2 Instance Connect with IPv6-only instances

This is the "service", rather than the endpoint functionality.

>The instance does not have a public IPv4 address
>To connect using the EC2 Instance Connect browser-based client, the instance must have a public IPv4 address.

> EC2 Instance Connect does not support connecting using an IPv6 address.
> https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-connect-methods.html


### You CANNOT use EC2 Instance Connect Endpoints with IPv6-only machines

EC2 Instance Connect Endpoint doesn't support connections to an instance using
IPv6 addresses:
https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/connect-using-eice.html#ec2-instance-connect-endpoint-limitations

Note that the endpoint cannot be created via code, so it must create manually:
[ec2-instance-connect.md](/doc/ec2-instance-connect-endpoint.md)

So it won't work with instances in ipv6-only subnets, but it does work with
dual-stack subnets. Meaning you can connect to an instance that has a private 
IPv4 address but no public IPv4 address, therefore no extra cost.


### You CANNOT use EC2 Instance Connect to access your private RDS database

SSM Session Manager allows you to connect through to your RDS database via
a private EC2 instance: https://aws.amazon.com/blogs/database/securely-connect-to-an-amazon-rds-or-amazon-ec2-database-instance-remotely-with-your-preferred-gui/

As far as I can tell, EC2 Instance Connect does not support any similar
functionality.


### Session Manager does not support IPv6

> Resources managed by AWS Systems Manager must have IPv4 connectivity to Systems Manager’s endpoints.
> https://docs.aws.amazon.com/whitepapers/latest/ipv6-on-aws/ipv6-security-and-monitoring-considerations.html
> https://stackoverflow.com/a/61340016/924597

Meaning if want to log in to your instances via Session Manager, you'll need to 
pay for a a NAT gateway or for the necessary VPC endpoints.  


### You CANNOT use "ECS Exec" with IPv6-only instances

[ECS exec](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-exec.html)
is implemented via SSM.  So if you want to get access to your tasks via exec,
you'll need a public IPv4 address or NAT functionality.


### VPC Endpoints do not support IPv6-only subnets

https://blog.devopstom.com/ipv6-only-ec2/

I think they'll work in a dual-stack, but they're expensive - you'd be better 
off just using a NAT gateway.


### Dockerhub default endpoints do not support IPv6

https://blog.miyuru.lk/dockerhub-ipv6/

Have to use `registry.ipv6.docker.com`.


### GitHub does not support IPv6

https://github.com/orgs/community/discussions/10539

I didn't actually try.

My assumption is that this means you would not be able to run codebuild 
projects that need to connect to github to pull the source, where that 
codebuild needs to run in a private subnet (for connectivity to an isolated
RDS subnet, etc.)


### ECS tasks cannot be deployed without IPv4 connectivity

When I tried deploying in the private dual-stack subject (WITHOUT NAT), 
the task would not transition out of `pending` to `running` - no errors visible.
Note that this test was running with `registry.ipv6.docker.com` in the image
specification.

Changing the image to be standard and putting the ASG into the private subnet
with NAT - the task deployed correctly.

MY assumption is that ECS uses SSM or some other AWS service that needs public 
IPv4 connectivity.
