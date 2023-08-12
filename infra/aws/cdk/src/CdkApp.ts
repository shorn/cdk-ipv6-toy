#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {SharedStatelessStack} from "./SharedStatelessStack";
import {NetworkStack} from './NetworkStack';
import {AccountServiceStack} from './AccountServiceStack';

const cdkApp = new cdk.App();

new AccountServiceStack(cdkApp, 'AccountService', {});

new NetworkStack(cdkApp, 'Network', {});

new SharedStatelessStack(cdkApp, 'SharedStateless', {});

