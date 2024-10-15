#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { JwtPizzaServiceStack } from '../lib/jwt-pizza-service-stack';

const app = new cdk.App();
new JwtPizzaServiceStack(app, 'JwtPizzaServiceStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  },
});