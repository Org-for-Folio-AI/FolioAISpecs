import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface APIGatewayStackProps extends cdk.StackProps {
  environment: string;
  appName: string;
  eventBus: events.EventBus;
  callInitiatorLambda: lambda.Function;
}

export class APIGatewayStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly apiEndpoint: string;

  constructor(scope: Construct, id: string, props: APIGatewayStackProps) {
    super(scope, id, props);

    // Create REST API
    this.api = new apigateway.RestApi(this, 'FolioAPI', {
      restApiName: `${props.appName}-api`,
      description: 'API for Folio Management System',
      endpointTypes: [apigateway.EndpointType.REGIONAL],
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization'],
      },
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.AnyPrincipal()],
            actions: ['execute-api:Invoke'],
            resources: ['execute-api:/*'],
          }),
        ],
      }),
    });

    this.apiEndpoint = this.api.url;

    // Create Lambda for API integration (event writer)
    const apiEventLambda = new lambda.Function(this, 'APIEventLambda', {
      functionName: `${props.appName}-api-event-publisher`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      code: lambda.Code.fromInline(`
        const { EventBridgeClient, PutEventsCommand } = require("@aws-sdk/client-eventbridge");
        const { v7: uuidv7 } = require('uuid');

        const eventBridge = new EventBridgeClient();

        exports.handler = async (event) => {
          console.log('Received API event:', JSON.stringify(event));

          try {
            const body = JSON.parse(event.body || '{}');
            const timestamp = new Date().toISOString();
            const eventId = uuidv7();

            const folioEvent = {
              Source: 'folio.api',
              DetailType: body.event_type || 'RecordCreated',
              EventBusName: process.env.EVENT_BUS_NAME,
              Detail: JSON.stringify({
                event_id: eventId,
                event_type: body.event_type || 'RecordCreated',
                aggregate_id: body.record_id || \`req_\${Date.now()}\`,
                timestamp,
                correlation_id: body.batch_id || body.call_id || eventId,
                data: body.data || body,
                metadata: {
                  user_id: body.user_id || 'api',
                  service: 'api',
                  version: '1.0',
                  request_id: event.requestContext?.requestId,
                },
              }),
            };

            const response = await eventBridge.send(new PutEventsCommand({
              Entries: [folioEvent],
            }));

            console.log('Event published:', response);

            return {
              statusCode: 202,
              body: JSON.stringify({
                message: 'Event accepted',
                event_id: eventId,
                status: 'processing',
              }),
            };
          } catch (error) {
            console.error('Error:', error);
            return {
              statusCode: 500,
              body: JSON.stringify({
                error: error.message,
              }),
            };
          }
        };
      `),
      environment: {
        EVENT_BUS_NAME: props.eventBus.eventBusName,
      },
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
    });

    // Grant EventBridge publish
    props.eventBus.grantPutEventsTo(apiEventLambda);

    // Endpoints

    // POST /records - Create new folio request record
    const recordsResource = this.api.root.addResource('records');
    recordsResource.addMethod('POST', new apigateway.LambdaIntegration(apiEventLambda), {
      methodResponses: [
        { statusCode: '202' },
        { statusCode: '400' },
        { statusCode: '500' },
      ],
    });

    // GET /records/{record_id}/status - Get record status
    const recordIdResource = recordsResource.addResource('{record_id}');
    recordIdResource.addMethod(
      'GET',
      new apigateway.MockIntegration({
        integrationResponses: [
          {
            statusCode: '200',
            responseTemplates: {
              'application/json': `{
                "record_id": "$input.params('record_id')",
                "status": "PROCESSING"
              }`,
            },
          },
        ],
      }),
      {
        methodResponses: [{ statusCode: '200' }],
      }
    );

    // Twilio Webhooks

    // POST /webhooks/twilio/call-status - Twilio call status callback
    const webhooksResource = this.api.root.addResource('webhooks');
    const twilioResource = webhooksResource.addResource('twilio');
    const callStatusResource = twilioResource.addResource('call-status');

    const twilioWebhookLambda = new lambda.Function(this, 'TwilioWebhookLambda', {
      functionName: `${props.appName}-twilio-webhook`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      code: lambda.Code.fromInline(`
        const { EventBridgeClient, PutEventsCommand } = require("@aws-sdk/client-eventbridge");
        const { v7: uuidv7 } = require('uuid');

        const eventBridge = new EventBridgeClient();

        exports.handler = async (event) => {
          console.log('Twilio webhook:', JSON.stringify(event));

          try {
            const body = event.body ? new URLSearchParams(event.body) : {};
            const callSid = body.get('CallSid');
            const callStatus = body.get('CallStatus');
            const timestamp = new Date().toISOString();

            const eventType = {
              initiated: 'CallInitiated',
              ringing: 'CallRinging',
              in_progress: 'CallConnected',
              completed: 'CallEnded',
              failed: 'CallFailed',
              busy: 'CallBusy',
              no_answer: 'CallNoAnswer',
            }[callStatus] || 'CallStatusChanged';

            const folioEvent = {
              Source: 'folio.twilio',
              DetailType: eventType,
              EventBusName: process.env.EVENT_BUS_NAME,
              Detail: JSON.stringify({
                event_id: uuidv7(),
                event_type: eventType,
                aggregate_id: callSid,
                timestamp,
                correlation_id: callSid,
                data: {
                  call_sid: callSid,
                  call_status: callStatus,
                  raw_params: Object.fromEntries(body),
                },
                metadata: {
                  service: 'twilio',
                  version: '1.0',
                },
              }),
            };

            await eventBridge.send(new PutEventsCommand({
              Entries: [folioEvent],
            }));

            return {
              statusCode: 200,
              body: JSON.stringify({ status: 'processed' }),
            };
          } catch (error) {
            console.error('Error:', error);
            return {
              statusCode: 500,
              body: JSON.stringify({ error: error.message }),
            };
          }
        };
      `),
      environment: {
        EVENT_BUS_NAME: props.eventBus.eventBusName,
      },
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
    });

    props.eventBus.grantPutEventsTo(twilioWebhookLambda);

    callStatusResource.addMethod('POST', new apigateway.LambdaIntegration(twilioWebhookLambda), {
      methodResponses: [
        { statusCode: '200' },
        { statusCode: '500' },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'APIEndpoint', {
      value: this.api.url,
      description: 'API Gateway endpoint URL',
    });

    new cdk.CfnOutput(this, 'RecordsEndpoint', {
      value: `${this.api.url}records`,
      description: 'Records POST endpoint',
    });

    new cdk.CfnOutput(this, 'TwilioWebhookEndpoint', {
      value: `${this.api.url}webhooks/twilio/call-status`,
      description: 'Twilio call status webhook endpoint',
    });
  }
}
