import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface SQSStackProps extends cdk.StackProps {
  environment: string;
  appName: string;
}

export class SQSStack extends cdk.Stack {
  public readonly schedulingQueue: sqs.Queue;
  public readonly callbackQueue: sqs.Queue;
  public readonly schedulingQueueDLQ: sqs.Queue;
  public readonly callbackQueueDLQ: sqs.Queue;

  constructor(scope: Construct, id: string, props: SQSStackProps) {
    super(scope, id, props);

    // Scheduling Queue DLQ: folio-scheduling-queue-dlq.fifo
    this.schedulingQueueDLQ = new sqs.Queue(this, 'SchedulingQueueDLQ', {
      queueName: `${props.appName}-scheduling-queue-dlq.fifo`,
      fifo: true,
      contentBasedDeduplication: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Scheduling Queue: folio-scheduling-queue.fifo
    // FIFO queue for scheduling records pickup
    // Batched by hotel to maintain order
    this.schedulingQueue = new sqs.Queue(this, 'SchedulingQueue', {
      queueName: `${props.appName}-scheduling-queue.fifo`,
      fifo: true,
      contentBasedDeduplication: false,
      visibilityTimeout: cdk.Duration.seconds(60),
      messageRetentionPeriod: cdk.Duration.hours(24),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      deadLetterQueue: {
        queue: this.schedulingQueueDLQ,
        maxReceiveCount: 3,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Callback Queue DLQ: folio-callback-queue-dlq.fifo
    this.callbackQueueDLQ = new sqs.Queue(this, 'CallbackQueueDLQ', {
      queueName: `${props.appName}-callback-queue-dlq.fifo`,
      fifo: true,
      contentBasedDeduplication: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Callback Queue: folio-callback-queue.fifo
    // FIFO queue for scheduling future callbacks
    // Supports scheduled delivery via visibility timeout
    this.callbackQueue = new sqs.Queue(this, 'CallbackQueue', {
      queueName: `${props.appName}-callback-queue.fifo`,
      fifo: true,
      contentBasedDeduplication: false,
      visibilityTimeout: cdk.Duration.seconds(120),
      messageRetentionPeriod: cdk.Duration.days(7),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      deadLetterQueue: {
        queue: this.callbackQueueDLQ,
        maxReceiveCount: 5,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Outputs
    new cdk.CfnOutput(this, 'SchedulingQueueUrl', {
      value: this.schedulingQueue.queueUrl,
      description: 'Scheduling Queue URL',
    });

    new cdk.CfnOutput(this, 'SchedulingQueueArn', {
      value: this.schedulingQueue.queueArn,
      description: 'Scheduling Queue ARN',
    });

    new cdk.CfnOutput(this, 'CallbackQueueUrl', {
      value: this.callbackQueue.queueUrl,
      description: 'Callback Queue URL',
    });

    new cdk.CfnOutput(this, 'CallbackQueueArn', {
      value: this.callbackQueue.queueArn,
      description: 'Callback Queue ARN',
    });
  }
}
