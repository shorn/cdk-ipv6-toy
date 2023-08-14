#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {SharedStatelessStack} from "./SharedStatelessStack";
import {NetworkStack} from './NetworkStack';
import {AccountServiceStack} from './AccountServiceStack';

const cdkApp = new cdk.App();

const service = new AccountServiceStack(cdkApp, 'AccountService', {});


const network = new NetworkStack(cdkApp, 'Network', {});

const sharedStateless = new SharedStatelessStack(cdkApp, 'SharedStateless', {
  vpc: network.testVpc
});

