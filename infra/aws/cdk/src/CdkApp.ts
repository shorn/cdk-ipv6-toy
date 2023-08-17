#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {createTestStacks} from './Test/TestStack';
import {Stack} from 'aws-cdk-lib';
import {CloudTrail} from './Shared/CloudTrail';

/* This forces the stacks to be environment-specific, yet still use
environment configured values (from profile, env variables, etc) so folks
can clone and run in whatever account/region they want.
[environment-specific](https://docs.aws.amazon.com/cdk/v2/guide/environments.html)
 */
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

/* I'm experimenting with not creating `Stack` classes.
I've noticed a personal tendency to abuse the custom stack classes:
 - doing stuff in the stack instead of just factoring out a construct,
 - passing around stack references instead of construct references
 - exporting outputs at the stack level instead of from the construct

This may encourage creating too many fine grained stacks though, we'll see.
*/
const cdkApp = new cdk.App();

const s2 = new Stack(cdkApp, 'AccountService', {env});
const cloudTrail = new CloudTrail(s2, 'CloudTrail');


createTestStacks(cdkApp, {env});
