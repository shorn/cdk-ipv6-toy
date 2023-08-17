Note that you only need to create the endpoint when/if you want to connect to 
the instance. The CDK app will be create just fine if you don't do this (in 
face you can't do it before creating the app, because the SecGroup won't exist). 

Cannot be created via code:
* https://github.com/aws/aws-cdk/issues/26226
* https://github.com/aws-cloudformation/cloudformation-coverage-roadmap/issues/1749


https://us-east-1.console.aws.amazon.com/vpc/home?region=us-east-1#CreateVpcEndpoint:

Name: manual-endpoint-01
Service category: EC2 Instance Connect Endpoint
VPC: vpc-xxx (test)
Preserve Client IP: false

Security groups: sg-xxx (SharedStateless-Ec2ConnectInstanceXXX-XXX)
Subnet: subnet-xxx (Network/TestIpv6/privateDualStackSubnet1)

