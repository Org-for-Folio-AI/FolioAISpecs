# AWS Serverless Architecture - Detailed Reference

## Overview

The Folio Management System is deployed on AWS using serverless services to achieve:
- **Auto-scaling**: Handle variable call volumes without capacity planning
- **Pay-per-use**: Cost optimized for event-driven workloads
- **High availability**: Multi-AZ by default
- **Managed infrastructure**: No servers to manage

## Service Mapping

### Compute Layer

| Component | Service | Concurrency | Timeout | Memory |
|-----------|---------|-------------|---------|--------|
| Scheduler | Lambda | 2 (reserved) | 30s | 512 MB |
| Batching Engine | Lambda | 5 | 60s | 1024 MB |
| Call Initiator | Lambda | 50 | 30s | 2048 MB |
| IVR Navigator | Lambda | 50 | 90s | 2048 MB |
| Voice Analyzer | Lambda | 50 | 30s | 2048 MB |
| Email Composer | Lambda | 10 | 30s | 512 MB |
| Email Monitor | Lambda | 5 | 300s | 1024 MB |
| Data Extractor | Lambda | 20 | 300s | 2048 MB |
| Callback Manager | Lambda | 10 | 30s | 512 MB |
| Status Manager | Lambda | 2 | 60s | 1024 MB |
| Event Writer | Lambda | 10 | 30s | 512 MB |

**Architecture**: ARM64 (Graviton2) - 20% better cost/performance than x86

### Orchestration Layer

**Step Functions Standard Workflow**: Call Handler
- **Max Duration**: 600 seconds
- **States**: 10+ states with choice logic
- **Error Handling**: Automatic retries, catch blocks
- **Logging**: CloudWatch Logs + X-Ray tracing

### Event Bus

**AWS EventBridge Custom Event Bus**: `folio-event-bus`
- **Event Sources**: Lambda functions, DynamoDB Streams, API Gateway
- **Event Types**: 40+ event types (RecordCreated, CallConnected, FolioExtracted, etc.)
- **Routing**: 9+ EventBridge rules for fan-out
- **Delivery**: Guaranteed at-least-once, automatic retries with DLQ

### Data Layer

#### DynamoDB Tables

**1. Event Store** (`folio-events`)
- **Primary Key**: `aggregate_id` (PK) + `sequence` (SK)
- **Capacity**: On-demand (scales automatically)
- **Encryption**: KMS-managed
- **Backup**: Point-in-time recovery enabled
- **Streams**: NEW_AND_OLD_IMAGES → EventBridge fan-out
- **GSI 1**: `event_type-timestamp-index` - query by event type
- **GSI 2**: `correlation_id-timestamp-index` - query by batch/call

**2. Status Projections** (`folio-status-projections`)
- **Primary Key**: `record_id` (PK)
- **Capacity**: On-demand
- **Purpose**: Materialized view for record status queries
- **GSI 1**: `status-updated_at-index` - list by status
- **GSI 2**: `hotel_id-created_at-index` - list by hotel

**3. Hotel Configuration** (`folio-hotel-config`)
- **Primary Key**: `hotel_id` (PK)
- **Purpose**: IVR profiles, contact preferences
- **TTL**: Disabled (configuration is permanent)

**4. Call Context** (`folio-call-context`)
- **Primary Key**: `call_id` (PK)
- **Purpose**: Temporary state during call execution
- **TTL**: 24 hours auto-delete (reduces storage costs)

#### Storage

**S3 Buckets**:
- `folio-call-recordings-{account-id}` - Twilio audio files
  - Lifecycle: Standard → Intelligent-Tiering (30d) → Glacier (365d) → Delete (2555d)
  - Cost: ~$0.023/GB/month after tiering

- `folio-email-attachments-{account-id}` - Email PDFs
  - Lifecycle: Standard → Standard-IA (30d) → Delete (730d)
  - Cost: ~$0.0125/GB/month after tiering

### Messaging Layer

**SQS FIFO Queues**:
- `folio-scheduling-queue.fifo` - Record pickup batching
  - Message Retention: 24 hours
  - Batch Size: 10
  - DLQ: `folio-scheduling-queue-dlq.fifo`

- `folio-callback-queue.fifo` - Future callback scheduling
  - Message Retention: 7 days
  - Batch Size: 5
  - DLQ: `folio-callback-queue-dlq.fifo`

### Integrations

#### External Services

**Twilio** (Voice Calls)
- **Outbound Calls**: Lambda → Twilio REST API → Hotel
- **IVR Control**: Send DTMF, record audio, analyze responses
- **Webhooks**: Twilio → API Gateway → Lambda → EventBridge

**Eleven Labs** (Voice AI)
- **Speech-to-Text**: Audio stream → Intent detection
- **Voice Synthesis**: Generate voice responses for IVR
- **API**: REST endpoints, 5 second latency typical

**AWS SES** (Email)
- **Sending**: Lambda → SES SendEmail or SendTemplatedEmail
- **Receiving**: SES Email Receiving → S3 → Lambda
- **Templates**: Pre-defined Folio request templates
- **Deliverability**: 99.9% success rate, DKIM/SPF verified

**AWS Textract** (Document OCR)
- **Async Jobs**: Extract text from PDF email attachments
- **API**: StartDocumentTextDetection → SNS notification → Lambda
- **Accuracy**: 99% for printed text, 90%+ for handwriting

## Event Flow Architecture

### Happy Path: Successful Call Completion

```
1. RecordCreated (API)
   ↓
2. EventBridge routes → Event Writer Lambda
   ↓
3. Event Writer → DynamoDB Event Store (PK: record_id, SK: sequence)
   ↓
4. DynamoDB Streams NEW_AND_OLD_IMAGES
   ↓
5. EventBridge Rule: Scheduler
   ↓
6. Scheduler Lambda (30s interval)
   ↓
7. EventBridge: RecordQueued → Batching Engine
   ↓
8. Batching Engine Lambda
   ↓
9. EventBridge: BatchScheduled → SQS Scheduling Queue
   ↓
10. Step Functions: Call Handler (invoked from Batching Engine)
    │
    ├─ InitiateCall (Lambda) → Twilio API
    │
    ├─ WaitForConnection (10s)
    │
    ├─ AnalyzeConnection (Lambda) → Detect IVR/Voicemail/Human
    │
    ├─ RouteByConnectionType (Choice)
    │  │
    │  ├─ IVR Path:
    │  │  ├─ NavigateIVR (Lambda) → Twilio DTMF + Eleven Labs
    │  │  └─ ProcessFolioRequests
    │  │
    │  └─ Human Path:
    │     └─ ProcessFolioRequests
    │
    ├─ ProcessFolioRequests (Loop)
    │  └─ RequestFolio → WaitForResponse (30s) → AnalyzeResponse
    │
    ├─ CheckCallDuration
    │
    └─ EndCall (Lambda) → Twilio Hangup + S3 Recording
        │
        └─ EventBridge: CallEnded
            ↓
11. Status Manager Lambda (DynamoDB Streams trigger)
    ↓
12. Update folio-status-projections table
    └─ Record status: AGREED_TO_SEND → EMAIL_SENT → ...
```

### Overflow Path: Email Escalation

```
If call duration > 540s:
    ↓
EventBridge: CallDurationExceeded
    ↓
Email Composer Lambda
    ↓
AWS SES: SendEmail to hotel
    ↓
Email Monitor Lambda (60s interval)
    ↓
WorkMail / IMAP: Check for responses
    ↓
EventBridge: EmailResponseReceived
    ↓
Data Extractor Lambda
    ↓
AWS Textract: Extract PDF attachment
    ↓
EventBridge: FolioExtracted
    ↓
Status Manager → Update record status to FOLIO_RECEIVED
```

### Callback Path: Future Scheduling

```
Hotel Response: "Call back in 2 hours"
    ↓
EventBridge: CallbackRequested
    ↓
Callback Manager Lambda
    ↓
SQS Callback Queue: SendMessage with DelaySeconds = 7200
    ↓
Wait 2 hours
    ↓
Scheduler Lambda: PickUp from SQS
    ↓
Continue from step 7 (Batching Engine)
```

## Security Architecture

### Encryption

- **At Rest**:
  - DynamoDB: KMS-managed keys (customer-managed)
  - S3: SSE-S3 (or SSE-KMS for sensitive environments)
  - Secrets Manager: KMS-managed keys

- **In Transit**:
  - EventBridge: TLS 1.2+
  - Lambda-to-SQS: TLS
  - Lambda-to-DynamoDB: TLS
  - API Gateway: HTTPS only

### IAM Policies

- **Least Privilege**: Each Lambda has role with minimum required permissions
- **No Wildcard Permissions**: Specific resource ARNs for all policies
- **Resource-Based Policies**: S3 bucket policies, SQS queue policies

Example Scheduler Lambda policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:Query"],
      "Resource": "arn:aws:dynamodb:us-east-1:123456789012:table/folio-events/index/*"
    },
    {
      "Effect": "Allow",
      "Action": ["sqs:SendMessage"],
      "Resource": "arn:aws:sqs:us-east-1:123456789012:folio-scheduling-queue.fifo"
    },
    {
      "Effect": "Allow",
      "Action": ["events:PutEvents"],
      "Resource": "arn:aws:events:us-east-1:123456789012:event-bus/folio-event-bus"
    }
  ]
}
```

### Secrets Management

- **Twilio**: Account SID + Auth Token in Secrets Manager
- **Eleven Labs**: API Key in Secrets Manager
- **Email**: SMTP/IMAP credentials in Secrets Manager
- **Rotation**: Automatic for supported services
- **Access**: Lambda retrieves on first invocation, cached in memory

## Observability

### CloudWatch Metrics

**Lambda Metrics**:
- Duration (avg, p50, p99, max)
- Invocations (count)
- Errors (count)
- Throttles (count)
- Concurrent Executions (current)

**DynamoDB Metrics**:
- Consumed Read/Write Capacity Units
- User Errors / System Errors
- Item Count
- Table Size

**SQS Metrics**:
- Messages Visible
- Messages Delayed
- Messages Sent
- Receive Count

**EventBridge Metrics**:
- Invocations
- Failed Invocations
- Rules

**Custom Metrics** (published by Lambdas):
- CallsInitiated, CallsConnected, CallsFailed
- EmailsSent, EmailResponsesReceived
- FoliosExtracted, FoliosAgreed

### CloudWatch Logs

- **Retention**: 7 days by default (configurable)
- **Structure**: JSON structured logging
- **Sampling**: Log every invocation (production: consider sampling)
- **Insights**: Query logs with CloudWatch Insights

### X-Ray Tracing

- **Enabled**: On all Lambdas and Step Functions
- **Sampling**: 10% of requests (development), adjust for production
- **Traces**: Show entire call flow end-to-end
- **Service Map**: Visualize dependencies

### CloudWatch Dashboards

1. **System Dashboard**: Lambda, EventBridge, DynamoDB metrics
2. **Call Dashboard**: Call success/failure, duration, IVR performance
3. **Email Dashboard**: Email send/receive, extraction success
4. **Cost Dashboard**: Invocation counts, RCU/WCU usage

## Monitoring & Alarms

### Critical Alarms

- **Lambda Errors**: Alert if any function has >5 errors in 5 minutes
- **DynamoDB User Errors**: Alert if >10 errors in 5 minutes
- **DynamoDB System Errors**: Alert immediately (indicates service issue)
- **SQS Backlog**: Alert if queue has >1000 messages
- **Step Functions Failures**: Alert if >5 executions failed
- **Step Functions Duration**: Alert if p99 > 550s (near timeout)

### Dashboards Update Frequency

- Real-time (1-minute periods)
- Aggregated (5-minute periods for stability)
- Historical (daily periods for trend analysis)

## Cost Optimization

### Strategies Implemented

1. **ARM64 Lambda**: 20% cost savings vs x86
2. **On-Demand DynamoDB**: No over-provisioning, auto-scales
3. **S3 Lifecycle**: Move to cheaper storage classes over time
4. **DynamoDB TTL**: Auto-delete expired call context
5. **SQS Batching**: 10x reduction in invocations
6. **Reserved Capacity** (post-launch): 30-70% savings

### Estimated Monthly Cost (dev environment, 1000 calls/day)

- Lambda invocations: ~$50
- DynamoDB: ~$40
- S3: ~$10 (mostly call recordings)
- EventBridge: ~$5
- SQS: <$1
- **Total**: ~$105/month

Production costs will depend on call volume and duration.

## Disaster Recovery

### Backup Strategy

- **DynamoDB PITR**: Point-in-time recovery enabled (35 days)
- **S3 Versioning**: Disabled (cost optimization), but lifecycle policies prevent loss
- **EventBridge Rule Backups**: Infrastructure-as-code (CDK)

### RTO/RPO

- **RTO** (Recovery Time Objective): <15 minutes (redeploy stack)
- **RPO** (Recovery Point Objective): <1 minute (DynamoDB Streams)
- **Data Loss**: No permanent data loss (event sourcing)

### Failover

- EventBridge: Multi-AZ by default
- DynamoDB: Multi-AZ by default
- Lambda: Automatic across AZs
- S3: Multi-region by design

## Next Steps

1. Deploy infrastructure (Phase 1)
2. Deploy Lambda function code
3. Configure secrets in Secrets Manager
4. Test end-to-end flow
5. Monitor dashboards
6. Optimize based on production metrics
