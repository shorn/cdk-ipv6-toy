
Experiments on minimising cost by creating AWS infrastructure that does not 
incur [IPv4 costs](https://aws.amazon.com/blogs/aws/new-aws-public-ipv4-address-charge-public-ip-insights/).

The AWS CDK source is in [/infra/aws/cdk](/infra/aws/cdk).


# AWS Configuration

This repo was tested with a clean account created via 
[AWS Organizations](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_introduction.html).


Credentials for the CDK are 
[configured via SSO](https://ben11kehoe.medium.com/never-put-aws-temporary-credentials-in-env-vars-or-credentials-files-theres-a-better-way-25ec45b4d73e),
my SSO user is defined with the`AdministratorAccess` permission set.

The CDK [package.json](/infra/aws/cdk/package.json) expects a `cdk-ipv6-toy`
config profile to be defined.

The `~/.aws/config`/` looks like:
```
[profile cdk-ipv6-toy]
sso_start_url = https://<SSO start url>>.awsapps.com/start
sso_region = <region of the SSO / ID Center stuff>
sso_account_id = <Account ID to deploy to>
sso_role_name = <SSO role name to deploy with>
region = <region to deploy to>
```

I sign-in with: `aws sso login --profile cdk-ipv6-toy`

The CDK project will work with explicit credentials in `~/.aws/credentials` 
if you want - temporary keys, IAM user keys, whatever floats your boat.


# CDK configuration

The CDK app is [environment-specific](https://docs.aws.amazon.com/cdk/v2/guide/environments.html),
but `cdk.context.json` is in `.gitignore` so that my own AWS Account ID is not 
published to github.

This means you should be able to deploy the app in your own account and region 
without having to change anything that might be specific to the region you want 
to deploy to (AMI IDs are why I had to do this).

The CDK will just re-populate the `cdk.context.json` with details from your 
account/region.  Don't commit `cdk.context.json` if your repo is public - it 
contains your Account ID. Many folks say sharing your Account ID isn't a big 
deal - but Amazon recommends to not share it.

> While account IDs, like any identifying information, should be used and 
> shared carefully, they are not considered secret, sensitive, or confidential 
> information.
> https://docs.aws.amazon.com/accounts/latest/reference/manage-acct-identifiers.html

At the very least, the Account ID can be used to make spear-phishing attempts 
look more legitimate - especially to folks in finance/accounts/support 
departments, who might assume than Account ID is something outsiders wouldn't 
know.


# Stuff I learned about AWS IPv6 support

[aws-ipv6-issues.md](/doc/aws-ipv6-issues.md)