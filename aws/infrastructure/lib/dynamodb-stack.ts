import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface DynamoDBStackProps extends cdk.StackProps {
  environment: string;
  appName: string;
  dynamodbKmsKey: kms.IKey;
}

export class DynamoDBStack extends cdk.Stack {
  public readonly eventStore: dynamodb.Table;
  public readonly statusProjections: dynamodb.Table;
  public readonly hotelConfig: dynamodb.Table;
  public readonly callContext: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DynamoDBStackProps) {
    super(scope, id, props);

    // Event Store Table: folio-events
    // Primary Key: aggregate_id (PK), sequence (SK)
    // Stores all immutable events in event sourcing pattern
    this.eventStore = new dynamodb.Table(this, 'EventStore', {
      tableName: `${props.appName}-events`,
      partitionKey: {
        name: 'aggregate_id',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'sequence',
        type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: props.dynamodbKmsKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      stream: dynamodb.StreamSpecification.NEW_AND_OLD_IMAGES,
    });

    // Global Secondary Index: event_type-timestamp-index
    this.eventStore.addGlobalSecondaryIndex({
      indexName: 'event_type-timestamp-index',
      partitionKey: {
        name: 'event_type',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY,
    });

    // Global Secondary Index: correlation_id-timestamp-index
    this.eventStore.addGlobalSecondaryIndex({
      indexName: 'correlation_id-timestamp-index',
      partitionKey: {
        name: 'correlation_id',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY,
    });

    // Status Projections Table: folio-status-projections
    // Primary Key: record_id (PK)
    // Maintains materialized view of record status for queries
    this.statusProjections = new dynamodb.Table(this, 'StatusProjections', {
      tableName: `${props.appName}-status-projections`,
      partitionKey: {
        name: 'record_id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: props.dynamodbKmsKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI: status-updated_at-index
    this.statusProjections.addGlobalSecondaryIndex({
      indexName: 'status-updated_at-index',
      partitionKey: {
        name: 'current_status',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'updated_at',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY,
    });

    // GSI: hotel_id-created_at-index
    this.statusProjections.addGlobalSecondaryIndex({
      indexName: 'hotel_id-created_at-index',
      partitionKey: {
        name: 'hotel_id',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'created_at',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY,
    });

    // Hotel Configuration Table: folio-hotel-config
    // Primary Key: hotel_id (PK)
    // Stores IVR profiles and hotel preferences
    this.hotelConfig = new dynamodb.Table(this, 'HotelConfig', {
      tableName: `${props.appName}-hotel-config`,
      partitionKey: {
        name: 'hotel_id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: props.dynamodbKmsKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Call Context Table: folio-call-context
    // Primary Key: call_id (PK)
    // Stores temporary state during call execution (TTL enabled)
    this.callContext = new dynamodb.Table(this, 'CallContext', {
      tableName: `${props.appName}-call-context`,
      partitionKey: {
        name: 'call_id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: props.dynamodbKmsKey,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'expiration',
    });

    // Outputs
    new cdk.CfnOutput(this, 'EventStoreTableName', {
      value: this.eventStore.tableName,
      description: 'Event Store table name',
    });

    new cdk.CfnOutput(this, 'EventStoreStreamArn', {
      value: this.eventStore.tableStreamArn!,
      description: 'Event Store DynamoDB Streams ARN',
    });

    new cdk.CfnOutput(this, 'StatusProjectionsTableName', {
      value: this.statusProjections.tableName,
      description: 'Status Projections table name',
    });

    new cdk.CfnOutput(this, 'HotelConfigTableName', {
      value: this.hotelConfig.tableName,
      description: 'Hotel Configuration table name',
    });

    new cdk.CfnOutput(this, 'CallContextTableName', {
      value: this.callContext.tableName,
      description: 'Call Context table name (with TTL)',
    });
  }
}
