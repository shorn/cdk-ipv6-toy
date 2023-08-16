#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {SharedStatelessStack} from "./SharedStatelessStack";
import {NetworkStack} from './NetworkStack';
import {AccountServiceStack} from './AccountServiceStack';

/* This forces the stacks to be environment-specific, yet still use
environment configured values (from profile, env variables, etc) so folks
can clone and run in whatever account/region they want.

[environment-specific](https://docs.aws.amazon.com/cdk/v2/guide/environments.html)
 */
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const cdkApp = new cdk.App();

const service = new AccountServiceStack(cdkApp, 'AccountService', {env});

const network = new NetworkStack(cdkApp, 'Network', {env});

const sharedStateless = new SharedStatelessStack(cdkApp, 'SharedStateless', {
  env,
  vpc: network.testVpc
});


