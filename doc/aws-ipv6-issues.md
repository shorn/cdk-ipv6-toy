As at 2023-08-14.

### You CANNOT create an ipv6-only vpc

Looks like there's currently no such thing.

### You CAN create an ipv6 only subnet using CDK
But you have to use [L1 constructs](https://docs.aws.amazon.com/cdk/v2/guide/cfn_layer.html),
see [NetworkStack.ts](/infra/aws/cdk/src/NetworkStack.ts)

### You CANNOT create an ALB in a single AZ
Not so much an IPv6 thing, as just something I wanted try - to reduce
ipv4 address costs and inter-AZ network costs

### You CANNOT create an IPv6-only ALB
If you create an ALB with one of it's subnets being ipv6-only, you will get:
```
Not enough IP space available in subnet-xxx. 
ELB requires at least 8 free IP addresses in each subnet.
```

### You CANNOT use the free-tier instance type with IPv6

`IPv6 addresses are not supported on t2.micro`


### You CANNOT use EC2 Instance Connect with IPv6-only instances

```
The instance does not have a public IPv4 address
To connect using the EC2 Instance Connect browser-based client, the instance must have a public IPv4 address.
```

