import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';

export interface EventBridgeStackProps extends cdk.StackProps {
  environment: string;
  appName: string;
}

export class EventBridgeStack extends cdk.Stack {
  public readonly eventBus: events.EventBus;

  constructor(scope: Construct, id: string, props: EventBridgeStackProps) {
    super(scope, id, props);

    // Create custom event bus for Folio system
    this.eventBus = new events.EventBus(this, 'FolioEventBus', {
      eventBusName: `${props.appName}-event-bus`,
    });

    // Event Bus Policy: Allow any service in account to publish
    this.eventBus.addToResourcePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        principals: [new cdk.aws_iam.AccountPrincipal(cdk.Stack.of(this).account)],
        actions: ['events:PutEvents'],
        resources: [this.eventBus.eventBusArn],
      })
    );

    // Schema Registry for event types (optional but recommended)
    new cdk.CfnOutput(this, 'EventBusArn', {
      value: this.eventBus.eventBusArn,
      description: 'Folio custom event bus ARN',
    });

    new cdk.CfnOutput(this, 'EventBusName', {
      value: this.eventBus.eventBusName,
      description: 'Folio custom event bus name',
    });
  }
}
