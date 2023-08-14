
Experiment on creating AWS infrastructure that does not incur 
[IPv4 costs](https://aws.amazon.com/blogs/aws/new-aws-public-ipv4-address-charge-public-ip-insights/).

The AWS CDK source is in [/infra/aws/cdk](/infra/aws/cdk).


# AWS Configuration

This repo was tested with a clean account created via AWS Organizations.
Credentials for the CDK are 
[configured via SSO](https://ben11kehoe.medium.com/never-put-aws-temporary-credentials-in-env-vars-or-credentials-files-theres-a-better-way-25ec45b4d73e)
, my SSO user is defined with the`AdministratorAccess` permission set.

The CDK [package.json](/infra/aws/cdk/package.json) expects a `cdk-ipv6-toy`
config profile to be defined.

The `~/.aws/config/ looks like:
```
[profile cdk-ipv6-toy]
sso_start_url = https://<SSO start url>>.awsapps.com/start
sso_region = us-east-1
sso_account_id = <Account ID where you want to create the resources>
sso_role_name = AdministratorAccess
region = us-east-1
```

I sign-in with:
`aws sso login --profile cdk-ipv6-toy`

The CDK project will work with explicit credentials in `~/.aws/credentials` 
if you want - temporary keys, IAM user keys, whatever floats your boat.


# Stuff I learned about AWS IPv6 support

[aws-ipv6-issues.md](/doc/aws-ipv6-issues.md)