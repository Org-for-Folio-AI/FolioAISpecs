import * as cdk from 'aws-cdk-lib';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface StepFunctionsStackProps extends cdk.StackProps {
  environment: string;
  appName: string;
  eventBus: events.EventBus;
  callContext: dynamodb.Table;
  callInitiatorLambda: lambda.Function;
  ivrNavigatorLambda: lambda.Function;
  voiceAnalyzerLambda: lambda.Function;
}

export class StepFunctionsStack extends cdk.Stack {
  public readonly callHandlerStateMachine: stepfunctions.StateMachine;

  constructor(scope: Construct, id: string, props: StepFunctionsStackProps) {
    super(scope, id, props);

    // Create IAM role for Step Functions
    const stepFunctionsRole = new iam.Role(this, 'StepFunctionsRole', {
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
    });

    // Grant EventBridge publish
    props.eventBus.grantPutEventsTo(stepFunctionsRole);

    // Grant Lambda invocation
    props.callInitiatorLambda.grantInvoke(stepFunctionsRole);
    props.ivrNavigatorLambda.grantInvoke(stepFunctionsRole);
    props.voiceAnalyzerLambda.grantInvoke(stepFunctionsRole);

    // Grant DynamoDB access
    props.callContext.grantReadWriteData(stepFunctionsRole);

    // Build Call Handler State Machine
    const callHandlerStateMachine = this.buildCallHandlerStateMachine(
      props,
      stepFunctionsRole
    );

    this.callHandlerStateMachine = new stepfunctions.StateMachine(
      this,
      'CallHandlerStateMachine',
      {
        definition: callHandlerStateMachine,
        stateMachineName: `${props.appName}-call-handler`,
        role: stepFunctionsRole,
        timeout: cdk.Duration.seconds(600),
        tracingEnabled: true,
        logs: {
          destination: new logs.LogGroup(this, 'CallHandlerStateMachineLogGroup', {
            logGroupName: `/aws/stepfunctions/${props.appName}-call-handler`,
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          }),
          level: stepfunctions.LogLevel.ERROR,
          includeExecutionData: true,
        },
      }
    );

    new cdk.CfnOutput(this, 'CallHandlerStateMachineArn', {
      value: this.callHandlerStateMachine.stateMachineArn,
      description: 'Call Handler State Machine ARN',
    });
  }

  private buildCallHandlerStateMachine(
    props: StepFunctionsStackProps,
    role: iam.Role
  ): stepfunctions.IChainable {
    // State 1: InitiateCall - Call Twilio to initiate outbound call
    const initiateCall = new tasks.LambdaInvoke(this, 'InitiateCall', {
      lambdaFunction: props.callInitiatorLambda,
      outputPath: '$.Payload',
      retryOnServiceExceptions: true,
    }).addRetry({
      maxAttempts: 2,
      interval: cdk.Duration.seconds(2),
      backoffRate: 2,
    });

    // State 2: WaitForConnection - Wait for call to connect
    const waitForConnection = new stepfunctions.Wait(this, 'WaitForConnection', {
      time: stepfunctions.WaitTime.duration(cdk.Duration.seconds(10)),
    });

    initiateCall.next(waitForConnection);

    // State 3: AnalyzeConnection - Detect IVR/Voicemail/Human
    const analyzeConnection = new tasks.LambdaInvoke(this, 'AnalyzeConnection', {
      lambdaFunction: props.callInitiatorLambda, // Reuse for simplicity in demo
      outputPath: '$.Payload',
    });

    waitForConnection.next(analyzeConnection);

    // State 4: RouteByConnectionType - Choice state based on call type
    const routeByConnectionType = new stepfunctions.Choice(this, 'RouteByConnectionType');

    const callType = stepfunctions.JsonPath.stringAt('$.connection_type');

    // Path: Voicemail detected
    const handleVoicemail = new stepfunctions.Pass(this, 'HandleVoicemail', {
      result: stepfunctions.Result.fromObject({
        status: 'voicemail_detected',
      }),
      resultPath: '$.voicemail_result',
    });

    // Path: Human detected
    const processFolioRequests = new stepfunctions.Pass(this, 'ProcessFolioRequests', {
      comment: 'Process folio requests with human',
    });

    // Path: IVR detected
    const navigateIVR = new tasks.LambdaInvoke(this, 'NavigateIVR', {
      lambdaFunction: props.ivrNavigatorLambda,
      outputPath: '$.Payload',
    }).addCatch(
      new stepfunctions.Pass(this, 'IVRNavigationFailed', {
        result: stepfunctions.Result.fromObject({
          status: 'ivr_navigation_failed',
        }),
        resultPath: '$.error',
      }),
      {
        resultPath: '$.error',
      }
    );

    routeByConnectionType
      .when(stepfunctions.Condition.stringEquals(callType, 'voicemail'), handleVoicemail)
      .when(stepfunctions.Condition.stringEquals(callType, 'ivr'), navigateIVR)
      .when(stepfunctions.Condition.stringEquals(callType, 'human'), processFolioRequests)
      .otherwise(
        new stepfunctions.Pass(this, 'UnknownConnectionType', {
          result: stepfunctions.Result.fromObject({
            status: 'unknown_connection_type',
          }),
        })
      );

    analyzeConnection.next(routeByConnectionType);

    // Voicemail path
    const endCallAfterVoicemail = new stepfunctions.Pass(this, 'EndCallAfterVoicemail', {
      comment: 'End call - voicemail detected',
    });

    handleVoicemail.next(endCallAfterVoicemail);

    // IVR path: After navigation, process folios
    navigateIVR.next(processFolioRequests);

    // Check call duration
    const checkCallDuration = new stepfunctions.Choice(this, 'CheckCallDuration');

    const callDurationSeconds = stepfunctions.JsonPath.numberAt('$.call_duration_seconds');

    const handleOverflow = new stepfunctions.Pass(this, 'HandleOverflow', {
      comment: 'Send overflow records via email',
      resultPath: '$.overflow_handled',
    });

    checkCallDuration
      .when(
        stepfunctions.Condition.numberGreaterThan(callDurationSeconds, 540),
        handleOverflow
      )
      .otherwise(
        new stepfunctions.Pass(this, 'NoOverflow', {
          comment: 'All records processed within time limit',
        })
      );

    processFolioRequests.next(checkCallDuration);

    // End call state
    const endCall = new stepfunctions.Pass(this, 'EndCall', {
      comment: 'Terminate call via Twilio',
    });

    handleOverflow.next(endCall);
    endCallAfterVoicemail.next(endCall);

    // Final state: Publish CallEnded event
    const publishCallEnded = new stepfunctions.Pass(this, 'PublishCallEnded', {
      comment: 'Publish CallEnded event to EventBridge',
    });

    endCall.next(publishCallEnded);

    return publishCallEnded;
  }
}
