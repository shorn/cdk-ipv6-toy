As at 2023-08-14.

Note that my personal perspective when researching this stuff is cost-first, 
not security-first. 

This repo was created out of my desire to research ways to use IPv6 to avoid
the new IPv4 public address charges.

### The ipv6 support page does not list all services that do not support IPv6

For example, the SSM is not listed on the 
[VPC IPv6 support page](https://docs.aws.amazon.com/vpc/latest/userguide/aws-ipv6-support.html).


### You CANNOT create an ipv6-only vpc

Looks like there's currently no such thing.


### You CAN create an ipv6-only subnet using CDK

But you have to use [L1 constructs](https://docs.aws.amazon.com/cdk/v2/guide/cfn_layer.html),
see [NetworkStack.ts](/infra/aws/cdk/src/NetworkStack.ts)


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
[ec2-instance-connect.md](/doc/ec2-instance-connect.md)

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


### VPC Endpoints do not support IPv6-only subnets

https://blog.devopstom.com/ipv6-only-ec2/

I think they'll work in a dual-stack, but they're expensive - you'd be better 
off just using a NAT gateway.


