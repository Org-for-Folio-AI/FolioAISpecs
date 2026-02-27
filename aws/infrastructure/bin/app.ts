import * as cdk from 'aws-cdk-lib';
import { FolioStack } from '../lib/folio-stack';

const app = new cdk.App();

// Read environment configuration
const environment = app.node.tryGetContext('environment') || 'dev';
const awsRegion = app.node.tryGetContext('awsRegion') || 'us-east-1';
const appName = app.node.tryGetContext('appName') || 'folio-management';

// Create main stack
const folioStack = new FolioStack(app, 'FolioStack', {
  environment,
  awsRegion,
  appName,
  env: {
    region: awsRegion,
  },
  description: 'AWS Serverless infrastructure for Folio Management System',
});

// Add tags to all stacks
const tags = app.node.tryGetContext('tags') || {};
for (const [key, value] of Object.entries(tags)) {
  cdk.Tags.of(app).add(key, String(value));
}
