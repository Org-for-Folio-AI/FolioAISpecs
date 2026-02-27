import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  environment: string;
  appName: string;
  lambdas: lambda.Function[];
  eventBus: events.EventBus;
  stepFunctions: stepfunctions.StateMachine[];
  queues: sqs.Queue[];
  tables: dynamodb.Table[];
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // Create dashboards
    this.createSystemDashboard(props);
    this.createCallDashboard(props);
    this.createEmailDashboard(props);
    this.createCostDashboard(props);

    // Create alarms
    this.createLambdaAlarms(props);
    this.createQueueAlarms(props);
    this.createDynamoDBAlarms(props);
    this.createStepFunctionsAlarms(props);
  }

  private createSystemDashboard(props: MonitoringStackProps): void {
    const dashboard = new cloudwatch.Dashboard(this, 'SystemDashboard', {
      dashboardName: `${props.appName}-system`,
    });

    // Lambda metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Invocations',
        left: props.lambdas.map(fn =>
          fn.metricInvocations({
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
          })
        ),
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Duration (ms)',
        left: props.lambdas.map(fn =>
          fn.metricDuration({
            statistic: 'Average',
            period: cdk.Duration.minutes(1),
          })
        ),
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Errors',
        left: props.lambdas.map(fn =>
          fn.metricErrors({
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
          })
        ),
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Throttles',
        left: props.lambdas.map(fn =>
          fn.metricThrottles({
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
          })
        ),
      })
    );

    // EventBridge metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'EventBridge Events Published',
        left: [
          props.eventBus.metricEvents({
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'EventBridge Invocations (Rules)',
        left: [
          props.eventBus.metricFailedInvocations({
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
          }),
        ],
      })
    );

    // DynamoDB metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Consumed Write Units',
        left: props.tables.map(table =>
          table.metricConsumedWriteCapacityUnits({
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
          })
        ),
      }),
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Consumed Read Units',
        left: props.tables.map(table =>
          table.metricConsumedReadCapacityUnits({
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
          })
        ),
      })
    );
  }

  private createCallDashboard(props: MonitoringStackProps): void {
    const dashboard = new cloudwatch.Dashboard(this, 'CallDashboard', {
      dashboardName: `${props.appName}-calls`,
    });

    // Call metrics (custom metrics from Lambda)
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Calls Initiated',
        left: [
          new cloudwatch.Metric({
            namespace: props.appName,
            metricName: 'CallsInitiated',
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'Calls Connected',
        left: [
          new cloudwatch.Metric({
            namespace: props.appName,
            metricName: 'CallsConnected',
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'Call Duration (seconds)',
        left: [
          new cloudwatch.Metric({
            namespace: props.appName,
            metricName: 'CallDuration',
            statistic: 'Average',
            period: cdk.Duration.minutes(1),
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'Calls Failed',
        left: [
          new cloudwatch.Metric({
            namespace: props.appName,
            metricName: 'CallsFailed',
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
          }),
        ],
      })
    );
  }

  private createEmailDashboard(props: MonitoringStackProps): void {
    const dashboard = new cloudwatch.Dashboard(this, 'EmailDashboard', {
      dashboardName: `${props.appName}-email`,
    });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Emails Sent',
        left: [
          new cloudwatch.Metric({
            namespace: props.appName,
            metricName: 'EmailsSent',
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'Email Responses Received',
        left: [
          new cloudwatch.Metric({
            namespace: props.appName,
            metricName: 'EmailResponsesReceived',
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'Folios Extracted',
        left: [
          new cloudwatch.Metric({
            namespace: props.appName,
            metricName: 'FoliosExtracted',
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'Email Monitor Errors',
        left: [
          new cloudwatch.Metric({
            namespace: props.appName,
            metricName: 'EmailMonitorErrors',
            statistic: 'Sum',
            period: cdk.Duration.minutes(1),
          }),
        ],
      })
    );
  }

  private createCostDashboard(props: MonitoringStackProps): void {
    const dashboard = new cloudwatch.Dashboard(this, 'CostDashboard', {
      dashboardName: `${props.appName}-cost`,
    });

    // Cost metrics (estimated)
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `# Cost Tracking

## Key Metrics
- Lambda invocations
- DynamoDB RCU/WCU
- S3 storage and data transfer
- EventBridge events

See CloudWatch Billing & Cost Management for actual costs.`,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Invocation Count (Cost Driver)',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Invocations',
            statistic: 'Sum',
            period: cdk.Duration.days(1),
          }),
        ],
      })
    );
  }

  private createLambdaAlarms(props: MonitoringStackProps): void {
    for (const fn of props.lambdas) {
      // Error rate alarm
      new cloudwatch.Alarm(this, `${fn.functionName}-ErrorsAlarm`, {
        metric: fn.metricErrors({
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5,
        evaluationPeriods: 1,
        alarmDescription: `${fn.functionName} had errors`,
        alarmName: `${props.appName}-${fn.functionName}-errors`,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      // Throttle alarm
      new cloudwatch.Alarm(this, `${fn.functionName}-ThrottlesAlarm`, {
        metric: fn.metricThrottles({
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription: `${fn.functionName} was throttled`,
        alarmName: `${props.appName}-${fn.functionName}-throttles`,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      // Duration alarm (p99)
      new cloudwatch.Alarm(this, `${fn.functionName}-DurationAlarm`, {
        metric: fn.metricDuration({
          statistic: 'p99',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 25000, // 25s - adjust based on timeout
        evaluationPeriods: 2,
        alarmDescription: `${fn.functionName} p99 duration exceeded`,
        alarmName: `${props.appName}-${fn.functionName}-duration-p99`,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    }
  }

  private createQueueAlarms(props: MonitoringStackProps): void {
    for (const queue of props.queues) {
      // Dead letter queue alarm
      new cloudwatch.Alarm(this, `${queue.fifoFifo ? queue.queueName : 'Queue'}-DLQAlarm`, {
        metric: queue.metricApproximateNumberOfMessagesVisible({
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription: `Messages in DLQ: ${queue.queueName}`,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      // High message count alarm
      new cloudwatch.Alarm(this, `${queue.fifoFifo ? queue.queueName : 'Queue'}-BacklogAlarm`, {
        metric: queue.metricApproximateNumberOfMessagesVisible({
          statistic: 'Maximum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 1000,
        evaluationPeriods: 2,
        alarmDescription: `High message backlog in ${queue.queueName}`,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    }
  }

  private createDynamoDBAlarms(props: MonitoringStackProps): void {
    for (const table of props.tables) {
      // User errors alarm
      new cloudwatch.Alarm(this, `${table.tableName}-UserErrorsAlarm`, {
        metric: table.metricUserErrors({
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 10,
        evaluationPeriods: 1,
        alarmDescription: `DynamoDB user errors in ${table.tableName}`,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      // System errors alarm
      new cloudwatch.Alarm(this, `${table.tableName}-SystemErrorsAlarm`, {
        metric: table.metricSystemErrors({
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription: `DynamoDB system errors in ${table.tableName}`,
        treatMissingData: cloudwatch.TreatMissingData.BREACHING,
      });
    }
  }

  private createStepFunctionsAlarms(props: MonitoringStackProps): void {
    for (const sm of props.stepFunctions) {
      // Execution failures alarm
      new cloudwatch.Alarm(this, `${sm.stateMachineName}-FailuresAlarm`, {
        metric: sm.metricFailed({
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5,
        evaluationPeriods: 1,
        alarmDescription: `Step Functions execution failures in ${sm.stateMachineName}`,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      // Execution duration alarm
      new cloudwatch.Alarm(this, `${sm.stateMachineName}-DurationAlarm`, {
        metric: sm.metricDuration({
          statistic: 'p99',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 550000, // 550s (out of 600s timeout)
        evaluationPeriods: 2,
        alarmDescription: `Step Functions p99 duration close to timeout in ${sm.stateMachineName}`,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    }
  }
}
