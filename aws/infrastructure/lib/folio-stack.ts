import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EventBridgeStack } from './eventbridge-stack';
import { DynamoDBStack } from './dynamodb-stack';
import { StepFunctionsStack } from './stepfunctions-stack';
import { LambdaStack } from './lambda-stack';
import { SQSStack } from './sqs-stack';
import { S3Stack } from './s3-stack';
import { APIGatewayStack } from './api-gateway-stack';
import { MonitoringStack } from './monitoring-stack';
import { SecurityStack } from './security-stack';

export interface FolioStackProps extends cdk.StackProps {
  environment: string;
  awsRegion: string;
  appName: string;
}

export class FolioStack extends cdk.Stack {
  // Exported resources for cross-stack references
  public readonly eventBus: any;
  public readonly eventStore: any;
  public readonly statusProjections: any;
  public readonly hotelConfig: any;
  public readonly callContext: any;
  public readonly schedulingQueue: any;
  public readonly callbackQueue: any;
  public readonly callRecordingsBucket: any;
  public readonly emailAttachmentsBucket: any;
  public readonly callHandlerStateMachine: any;
  public readonly secretsKmsKey: any;
  public readonly dynamodbKmsKey: any;
  public readonly s3KmsKey: any;

  constructor(scope: Construct, id: string, props: FolioStackProps) {
    super(scope, id, props);

    const config = this.node.tryGetContext('context') || {};
    const tags = config.tags || {};

    // Add project tags
    cdk.Tags.of(this).add('Project', tags.Project || 'FolioAI');
    cdk.Tags.of(this).add('Environment', props.environment);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');

    // Phase 1: Security (Secrets, KMS)
    const securityStack = new SecurityStack(this, 'SecurityStack', {
      environment: props.environment,
      appName: props.appName,
    });

    this.secretsKmsKey = securityStack.secretsKmsKey;
    this.dynamodbKmsKey = securityStack.dynamodbKmsKey;
    this.s3KmsKey = securityStack.s3KmsKey;

    // Phase 1: Storage (DynamoDB Event Store)
    const dynamodbStack = new DynamoDBStack(this, 'DynamoDBStack', {
      environment: props.environment,
      appName: props.appName,
      dynamodbKmsKey: this.dynamodbKmsKey,
    });

    this.eventStore = dynamodbStack.eventStore;
    this.statusProjections = dynamodbStack.statusProjections;
    this.hotelConfig = dynamodbStack.hotelConfig;
    this.callContext = dynamodbStack.callContext;

    // Phase 1: Event Bus (EventBridge)
    const eventBridgeStack = new EventBridgeStack(this, 'EventBridgeStack', {
      environment: props.environment,
      appName: props.appName,
    });

    this.eventBus = eventBridgeStack.eventBus;

    // Phase 1: Queues (SQS)
    const sqsStack = new SQSStack(this, 'SQSStack', {
      environment: props.environment,
      appName: props.appName,
    });

    this.schedulingQueue = sqsStack.schedulingQueue;
    this.callbackQueue = sqsStack.callbackQueue;

    // Phase 1: Storage (S3)
    const s3Stack = new S3Stack(this, 'S3Stack', {
      environment: props.environment,
      appName: props.appName,
      s3KmsKey: this.s3KmsKey,
    });

    this.callRecordingsBucket = s3Stack.callRecordingsBucket;
    this.emailAttachmentsBucket = s3Stack.emailAttachmentsBucket;

    // Phase 2-3: Lambda Functions
    const lambdaStack = new LambdaStack(this, 'LambdaStack', {
      environment: props.environment,
      appName: props.appName,
      eventBus: this.eventBus,
      eventStore: this.eventStore,
      statusProjections: this.statusProjections,
      hotelConfig: this.hotelConfig,
      callContext: this.callContext,
      schedulingQueue: this.schedulingQueue,
      callbackQueue: this.callbackQueue,
      callRecordingsBucket: this.callRecordingsBucket,
      emailAttachmentsBucket: this.emailAttachmentsBucket,
      secretsKmsKey: this.secretsKmsKey,
    });

    // Phase 3: Step Functions (Call Handler Workflow)
    const stepFunctionsStack = new StepFunctionsStack(this, 'StepFunctionsStack', {
      environment: props.environment,
      appName: props.appName,
      eventBus: this.eventBus,
      callContext: this.callContext,
      callInitiatorLambda: lambdaStack.callInitiatorLambda,
      ivrNavigatorLambda: lambdaStack.ivrNavigatorLambda,
      voiceAnalyzerLambda: lambdaStack.voiceAnalyzerLambda,
    });

    this.callHandlerStateMachine = stepFunctionsStack.callHandlerStateMachine;

    // Update Batching Engine Lambda with Step Functions reference
    lambdaStack.updateWithStepFunctions(this.callHandlerStateMachine);

    // Phase 4: API Gateway
    const apiGatewayStack = new APIGatewayStack(this, 'APIGatewayStack', {
      environment: props.environment,
      appName: props.appName,
      eventBus: this.eventBus,
      callInitiatorLambda: lambdaStack.callInitiatorLambda,
    });

    // Phase 5: Monitoring (CloudWatch, X-Ray, Alarms)
    const monitoringStack = new MonitoringStack(this, 'MonitoringStack', {
      environment: props.environment,
      appName: props.appName,
      lambdas: lambdaStack.getAllLambdas(),
      eventBus: this.eventBus,
      stepFunctions: [this.callHandlerStateMachine],
      queues: [this.schedulingQueue, this.callbackQueue],
      tables: [this.eventStore, this.statusProjections],
    });

    // Outputs
    new cdk.CfnOutput(this, 'EventBusName', {
      value: this.eventBus.eventBusName,
      description: 'Custom Event Bus for Folio system',
    });

    new cdk.CfnOutput(this, 'EventStoreTableName', {
      value: this.eventStore.tableName,
      description: 'DynamoDB Event Store table',
    });

    new cdk.CfnOutput(this, 'CallHandlerStateMachineArn', {
      value: this.callHandlerStateMachine.stateMachineArn,
      description: 'Call Handler Step Functions State Machine',
    });

    new cdk.CfnOutput(this, 'APIGatewayEndpoint', {
      value: apiGatewayStack.apiEndpoint,
      description: 'API Gateway endpoint for record creation and webhooks',
    });

    new cdk.CfnOutput(this, 'DashboardURL', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${props.env?.region}#dashboards:name=folio-system`,
      description: 'CloudWatch Dashboard URL',
    });
  }
}
