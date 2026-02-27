import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import * as path from 'path';

export interface LambdaStackProps extends cdk.StackProps {
  environment: string;
  appName: string;
  eventBus: events.EventBus;
  eventStore: dynamodb.Table;
  statusProjections: dynamodb.Table;
  hotelConfig: dynamodb.Table;
  callContext: dynamodb.Table;
  schedulingQueue: sqs.Queue;
  callbackQueue: sqs.Queue;
  callRecordingsBucket: s3.Bucket;
  emailAttachmentsBucket: s3.Bucket;
  secretsKmsKey: kms.IKey;
}

export class LambdaStack extends cdk.Stack {
  public schedulerLambda: lambda.Function;
  public batchingEngineLambda: lambda.Function;
  public callInitiatorLambda: lambda.Function;
  public ivrNavigatorLambda: lambda.Function;
  public voiceAnalyzerLambda: lambda.Function;
  public emailComposerLambda: lambda.Function;
  public emailMonitorLambda: lambda.Function;
  public dataExtractorLambda: lambda.Function;
  public callbackManagerLambda: lambda.Function;
  public statusManagerLambda: lambda.Function;
  public eventWriterLambda: lambda.Function;

  private lambdaRole: iam.Role;
  private props: LambdaStackProps;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    this.props = props;

    // Create base IAM role for all Lambdas
    this.lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      ],
    });

    // Grant EventBus publish access
    props.eventBus.grantPutEventsTo(this.lambdaRole);

    // Grant DynamoDB access
    props.eventStore.grantReadWriteData(this.lambdaRole);
    props.statusProjections.grantReadWriteData(this.lambdaRole);
    props.hotelConfig.grantReadData(this.lambdaRole);
    props.callContext.grantReadWriteData(this.lambdaRole);

    // Grant Streams access
    this.lambdaRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'dynamodb:GetRecords',
          'dynamodb:GetItem',
          'dynamodb:BatchGetItem',
          'dynamodb:ListStreams',
          'dynamodb:ListRecords',
        ],
        resources: [props.eventStore.tableStreamArn || ''],
      })
    );

    // Grant SQS access
    props.schedulingQueue.grantSendMessages(this.lambdaRole);
    props.callbackQueue.grantSendMessages(this.lambdaRole);
    props.schedulingQueue.grantConsumeMessages(this.lambdaRole);
    props.callbackQueue.grantConsumeMessages(this.lambdaRole);

    // Grant S3 access
    props.callRecordingsBucket.grantReadWrite(this.lambdaRole);
    props.emailAttachmentsBucket.grantReadWrite(this.lambdaRole);

    // Grant Secrets Manager access
    props.secretsKmsKey.grantDecrypt(this.lambdaRole);
    this.lambdaRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'secretsmanager:GetSecretValue',
          'secretsmanager:DescribeSecret',
        ],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:${props.appName}/*`,
        ],
      })
    );

    // Create Lambda functions
    this.eventWriterLambda = this.createLambda('EventWriter', {
      memorySize: 512,
      timeout: 30,
      reservedConcurrentExecutions: 10,
    });

    this.schedulerLambda = this.createLambda('Scheduler', {
      memorySize: 512,
      timeout: 30,
      reservedConcurrentExecutions: 2,
    });

    this.batchingEngineLambda = this.createLambda('BatchingEngine', {
      memorySize: 1024,
      timeout: 60,
      reservedConcurrentExecutions: 5,
    });

    this.callInitiatorLambda = this.createLambda('CallInitiator', {
      memorySize: 2048,
      timeout: 30,
      reservedConcurrentExecutions: 50,
    });

    this.ivrNavigatorLambda = this.createLambda('IVRNavigator', {
      memorySize: 2048,
      timeout: 90,
      reservedConcurrentExecutions: 50,
    });

    this.voiceAnalyzerLambda = this.createLambda('VoiceAnalyzer', {
      memorySize: 2048,
      timeout: 30,
      reservedConcurrentExecutions: 50,
    });

    this.emailComposerLambda = this.createLambda('EmailComposer', {
      memorySize: 512,
      timeout: 30,
      reservedConcurrentExecutions: 10,
    });

    this.emailMonitorLambda = this.createLambda('EmailMonitor', {
      memorySize: 1024,
      timeout: 300,
      reservedConcurrentExecutions: 5,
    });

    this.dataExtractorLambda = this.createLambda('DataExtractor', {
      memorySize: 2048,
      timeout: 300,
      reservedConcurrentExecutions: 20,
    });

    this.callbackManagerLambda = this.createLambda('CallbackManager', {
      memorySize: 512,
      timeout: 30,
      reservedConcurrentExecutions: 10,
    });

    this.statusManagerLambda = this.createLambda('StatusManager', {
      memorySize: 1024,
      timeout: 60,
      reservedConcurrentExecutions: 2,
    });

    // Grant additional permissions for Data Extractor (Textract)
    this.dataExtractorLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'textract:StartDocumentTextDetection',
          'textract:GetDocumentTextDetection',
          'textract:StartDocumentAnalysis',
          'textract:GetDocumentAnalysis',
        ],
        resources: ['*'],
      })
    );

    // Grant additional permissions for Email Monitor (SES)
    this.emailMonitorLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'workmail:ListIncomingMessages',
          'workmail:GetIncomingMessageContent',
          'workmail:GetMessage',
        ],
        resources: ['*'],
      })
    );

    // Grant additional permissions for Email Composer (SES)
    this.emailComposerLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'ses:SendEmail',
          'ses:SendRawEmail',
          'ses:SendTemplatedEmail',
          'sesv2:SendEmail',
        ],
        resources: ['*'],
      })
    );

    // Grant Step Functions permissions
    this.batchingEngineLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'states:StartExecution',
        ],
        resources: ['*'],
      })
    );

    // Outputs
    new cdk.CfnOutput(this, 'SchedulerLambdaArn', {
      value: this.schedulerLambda.functionArn,
      description: 'Scheduler Lambda ARN',
    });

    new cdk.CfnOutput(this, 'EventWriterLambdaArn', {
      value: this.eventWriterLambda.functionArn,
      description: 'Event Writer Lambda ARN',
    });
  }

  private createLambda(
    name: string,
    config: {
      memorySize: number;
      timeout: number;
      reservedConcurrentExecutions?: number;
    }
  ): lambda.Function {
    const fn = new lambda.Function(this, `${name}Lambda`, {
      functionName: `${this.props.appName}-${name.toLowerCase().replace(/([A-Z])/g, '-$1')}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      code: lambda.Code.fromAsset(path.join(__dirname, `../../lambdas/${name}`)),
      handler: 'index.handler',
      role: this.lambdaRole,
      memorySize: config.memorySize,
      timeout: cdk.Duration.seconds(config.timeout),
      ephemeralStorageSize: cdk.Size.mebibytes(512),
      environment: {
        APP_NAME: this.props.appName,
        ENVIRONMENT: this.props.environment,
        EVENT_BUS_NAME: this.props.eventBus.eventBusName,
        EVENT_STORE_TABLE: this.props.eventStore.tableName,
        STATUS_PROJECTIONS_TABLE: this.props.statusProjections.tableName,
        HOTEL_CONFIG_TABLE: this.props.hotelConfig.tableName,
        CALL_CONTEXT_TABLE: this.props.callContext.tableName,
        SCHEDULING_QUEUE_URL: this.props.schedulingQueue.queueUrl,
        CALLBACK_QUEUE_URL: this.props.callbackQueue.queueUrl,
        CALL_RECORDINGS_BUCKET: this.props.callRecordingsBucket.bucketName,
        EMAIL_ATTACHMENTS_BUCKET: this.props.emailAttachmentsBucket.bucketName,
        AWS_REGION: this.region,
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: cdk.aws_logs.RetentionDays.ONE_WEEK,
      reservedConcurrentExecutions: config.reservedConcurrentExecutions,
    });

    return fn;
  }

  public updateWithStepFunctions(stateMachine: cdk.aws_stepfunctions.StateMachine) {
    this.batchingEngineLambda.addEnvironment('CALL_HANDLER_STATE_MACHINE_ARN', stateMachine.stateMachineArn);
  }

  public getAllLambdas(): lambda.Function[] {
    return [
      this.schedulerLambda,
      this.batchingEngineLambda,
      this.callInitiatorLambda,
      this.ivrNavigatorLambda,
      this.voiceAnalyzerLambda,
      this.emailComposerLambda,
      this.emailMonitorLambda,
      this.dataExtractorLambda,
      this.callbackManagerLambda,
      this.statusManagerLambda,
      this.eventWriterLambda,
    ];
  }
}
