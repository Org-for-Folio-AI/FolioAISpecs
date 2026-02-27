# AWS Serverless Implementation

This directory contains the AWS CDK/CloudFormation infrastructure and Lambda function implementations for deploying the Folio management system on AWS serverless services.

## Directory Structure

```
aws/
├── README.md                          # This file
├── infrastructure/
│   ├── cdk.json                       # CDK configuration
│   ├── lib/
│   │   ├── folio-stack.ts            # Main stack
│   │   ├── eventbridge-stack.ts       # EventBridge configuration
│   │   ├── dynamodb-stack.ts          # DynamoDB tables
│   │   ├── stepfunctions-stack.ts     # Step Functions workflows
│   │   ├── lambda-stack.ts            # Lambda functions
│   │   ├── sqs-stack.ts               # SQS queues
│   │   ├── s3-stack.ts                # S3 buckets
│   │   ├── api-gateway-stack.ts       # API Gateway
│   │   ├── monitoring-stack.ts        # CloudWatch & X-Ray
│   │   └── security-stack.ts          # Secrets, KMS, IAM
│   └── bin/
│       └── app.ts                     # CDK app entry point
├── lambdas/
│   ├── scheduler/                     # Scheduler Lambda
│   ├── batching-engine/               # Batching Engine Lambda
│   ├── call-initiator/                # Call Initiator Lambda
│   ├── ivr-navigator/                 # IVR Navigator Lambda
│   ├── voice-analyzer/                # Voice Analyzer Lambda
│   ├── email-composer/                # Email Composer Lambda
│   ├── email-monitor/                 # Email Monitor Lambda
│   ├── data-extractor/                # Data Extractor Lambda
│   ├── callback-manager/              # Callback Manager Lambda
│   ├── status-manager/                # Status Manager Lambda
│   ├── event-writer/                  # Event Store Writer Lambda
│   ├── shared/                        # Shared utilities
│   │   ├── event-bus.ts              # EventBridge client
│   │   ├── dynamodb-client.ts        # DynamoDB client
│   │   ├── aws-secrets.ts            # Secrets Manager client
│   │   ├── logger.ts                 # Logging utility
│   │   ├── types.ts                  # Shared TypeScript types
│   │   └── constants.ts              # Constants
│   └── tests/                         # Lambda unit tests
├── step-functions/
│   ├── call-handler.json              # Call Handler state machine definition
│   └── call-handler.drawio            # Visual workflow diagram
├── deployment/
│   ├── deploy.sh                      # Deployment script
│   ├── destroy.sh                     # Cleanup script
│   ├── env.example                    # Environment variables template
│   └── post-deployment.sh             # Post-deployment setup
├── monitoring/
│   ├── dashboards/
│   │   ├── system-dashboard.json      # Overall system metrics
│   │   ├── call-dashboard.json        # Call metrics
│   │   ├── email-dashboard.json       # Email metrics
│   │   └── cost-dashboard.json        # Cost tracking
│   ├── alarms.ts                      # CloudWatch alarm definitions
│   └── x-ray-config.ts                # X-Ray tracing setup
├── testing/
│   ├── e2e-tests.ts                   # End-to-end test scenarios
│   ├── load-test.ts                   # Load testing with Artillery
│   └── fixtures/                      # Test data fixtures
└── docs/
    ├── DEPLOYMENT.md                  # Step-by-step deployment guide
    ├── ARCHITECTURE.md                # AWS architecture details
    ├── COST-OPTIMIZATION.md           # Cost reduction strategies
    ├── TROUBLESHOOTING.md             # Common issues and solutions
    └── API-REFERENCE.md               # API Gateway endpoints
```

## Quick Start

```bash
# Install dependencies
npm install

# Set environment variables
cp deployment/env.example deployment/env.local
# Edit deployment/env.local with your values

# Deploy to AWS
cd infrastructure
cdk deploy --require-approval never

# Run end-to-end tests
npm run test:e2e
```

## Key Features

- **Event-Driven Architecture**: EventBridge routes 40+ event types
- **Step Functions Orchestration**: Call Handler implements complex call workflows
- **Serverless Compute**: All components as Lambda functions (ARM64)
- **Event Sourcing**: DynamoDB event store with Streams
- **External Integrations**: Twilio (calls), Eleven Labs (voice AI), AWS SES (email)
- **Scalable Storage**: S3 for recordings and attachments with lifecycle policies
- **Comprehensive Monitoring**: CloudWatch dashboards, X-Ray tracing, alarms

## Environment Variables

See `deployment/env.example` for required environment variables:
- AWS account ID and region
- Twilio credentials
- Eleven Labs API key
- Email configuration
- Feature flags

## Cost Estimation

See `docs/COST-OPTIMIZATION.md` for detailed cost breakdown and optimization strategies.

## Implementation Status

- [x] Phase 1: Event Infrastructure
- [ ] Phase 2: Scheduler & Batching
- [ ] Phase 3: Call Handler
- [ ] Phase 4: Email System
- [ ] Phase 5: Status & Callbacks
- [ ] Phase 6: Monitoring & Optimization

## Reference Documentation

- **Business Requirements**: [Folio-spec-consolidated.md](../Folio-spec-consolidated.md)
- **Technical Architecture**: [design/Technical-Architecture-HLD.md](../design/Technical-Architecture-HLD.md)
- **Event Catalog**: [design/Event-Catalog.md](../design/Event-Catalog.md)
- **Component Specs**: `design/components/*.md`
