# Deployment Guide

## Prerequisites

### AWS Account Setup

1. **AWS Account** with appropriate permissions
   - Admin or PowerUser policy (for initial setup)
   - Can be restricted post-deployment

2. **AWS CLI** installed and configured
   ```bash
   aws --version  # v2.x or later
   aws configure  # Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
   ```

3. **Node.js 18+** installed
   ```bash
   node --version
   npm --version
   ```

4. **AWS CDK** installed globally
   ```bash
   npm install -g aws-cdk
   cdk --version  # v2.100 or later
   ```

### External Service Accounts

- **Twilio Account**: Phone number, Account SID, Auth Token
- **Eleven Labs Account**: API key, voice ID
- **Email Account**: SMTP credentials (Gmail, Office 365, etc.) or AWS SES
- **AWS SES**: Domain verified (if using SES for email)

## Phase 1: Infrastructure Deployment

### Step 1: Prepare Environment

```bash
cd /path/to/FolioAISpecs/aws/infrastructure

# Install dependencies
npm install

# Copy environment template
cp ../deployment/env.example ../deployment/env.local

# Edit with your values
nano ../deployment/env.local
```

Required environment variables:
- `AWS_REGION` - AWS region (us-east-1, us-west-2, etc.)
- `AWS_ACCOUNT_ID` - Your AWS account ID
- `ENVIRONMENT` - dev, staging, prod
- `APP_NAME` - folio-management (or custom name)

### Step 2: Bootstrap CDK

```bash
# First deployment in account requires bootstrap
source ../deployment/env.local
cdk bootstrap aws://${AWS_ACCOUNT_ID}/${AWS_REGION}
```

### Step 3: Review Stack

```bash
# See what will be deployed
cdk diff

# See CloudFormation template
cdk synth
```

### Step 4: Deploy Infrastructure

```bash
# Deploy the stack (requires confirmation)
cdk deploy --require-approval=never

# Or step through confirmations
cdk deploy
```

**Expected Deployment Time**: 10-15 minutes

**Outputs** (save these):
```
Outputs:
FolioStack.EventBusName = folio-event-bus
FolioStack.EventStoreTableName = folio-events
FolioStack.CallHandlerStateMachineArn = arn:aws:states:us-east-1:123...
FolioStack.APIGatewayEndpoint = https://xxx.execute-api.us-east-1.amazonaws.com/
FolioStack.DashboardURL = https://console.aws.amazon.com/cloudwatch...
```

## Phase 2: Configure Secrets

### Update Twilio Secret

```bash
source ../deployment/env.local

aws secretsmanager update-secret \
  --secret-id ${APP_NAME}/twilio \
  --region ${AWS_REGION} \
  --secret-string '{
    "account_sid": "'${TWILIO_ACCOUNT_SID}'",
    "auth_token": "'${TWILIO_AUTH_TOKEN}'",
    "phone_number": "'${TWILIO_PHONE_NUMBER}'"
  }'
```

### Update Eleven Labs Secret

```bash
aws secretsmanager update-secret \
  --secret-id ${APP_NAME}/elevenlabs \
  --region ${AWS_REGION} \
  --secret-string '{
    "api_key": "'${ELEVENLABS_API_KEY}'",
    "voice_id": "'${ELEVENLABS_VOICE_ID}'"
  }'
```

### Update Email Secret

```bash
aws secretsmanager update-secret \
  --secret-id ${APP_NAME}/email \
  --region ${AWS_REGION} \
  --secret-string '{
    "smtp_host": "'${EMAIL_SMTP_HOST}'",
    "smtp_port": 587,
    "smtp_user": "'${EMAIL_SMTP_USER}'",
    "smtp_password": "'${EMAIL_SMTP_PASSWORD}'",
    "imap_host": "'${EMAIL_IMAP_HOST}'",
    "imap_port": 993,
    "imap_user": "'${EMAIL_IMAP_USER}'",
    "imap_password": "'${EMAIL_IMAP_PASSWORD}'"
  }'
```

**Verify** secrets were updated:
```bash
aws secretsmanager get-secret-value \
  --secret-id ${APP_NAME}/twilio \
  --region ${AWS_REGION}
```

## Phase 3: Deploy Lambda Functions

### Step 1: Create Lambda Function Stubs

Each Lambda needs an `index.js` handler in its directory:

```bash
# Create directories
mkdir -p ../lambdas/{scheduler,batching-engine,call-initiator,ivr-navigator,voice-analyzer,email-composer,email-monitor,data-extractor,callback-manager,status-manager,event-writer}

# Create basic handler for each
for dir in ../lambdas/*/; do
  cat > "${dir}index.js" << 'EOF'
console.log('Lambda function handler - to be implemented');

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Function placeholder' }),
  };
};
EOF
done
```

### Step 2: Deploy Lambda Layer (Shared Dependencies)

```bash
# Create Lambda layer with shared dependencies
mkdir -p ../lambdas/shared/nodejs/node_modules
cd ../lambdas/shared

npm init -y
npm install uuid @aws-sdk/client-dynamodb @aws-sdk/client-eventbridge @aws-sdk/client-sqs aws-sdk

# Package layer
cd nodejs
cp -r ../node_modules .
zip -r ../../lambda-layer.zip .
cd ../..

# Upload layer to Lambda
aws lambda publish-layer-version \
  --layer-name ${APP_NAME}-shared \
  --zip-file fileb://lambda-layer.zip \
  --compatible-runtimes nodejs20.x \
  --region ${AWS_REGION}
```

### Step 3: Re-deploy Stack with Lambdas

```bash
cd ../infrastructure
cdk deploy --require-approval=never
```

## Phase 4: Configure Twilio

### Step 1: Create Twilio Phone Number Webhook

```bash
# Get API endpoint from outputs
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name FolioStack \
  --query 'Stacks[0].Outputs[?OutputKey==`APIGatewayEndpoint`].OutputValue' \
  --output text \
  --region ${AWS_REGION})

# Configure Twilio webhook for your phone number
# In Twilio console: Phone Numbers → Manage Numbers → [Your Number]
# Set Status Callback URL to: ${API_ENDPOINT}webhooks/twilio/call-status
```

### Step 2: Configure Twilio TwiML Callbacks

Create TwiML applications in Twilio console:
```xml
<!-- Sample TwiML for greeting -->
<Response>
  <Gather method="post" numDigits="1" action="${API_ENDPOINT}/twiml/menu" timeout="5">
    <Say>Please press 1 to continue with your request</Say>
  </Gather>
</Response>
```

## Phase 5: Test Deployment

### Test 1: Create Record via API

```bash
curl -X POST ${API_ENDPOINT}/records \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "RecordCreated",
    "record_id": "test_001",
    "data": {
      "guest_first_name": "Test",
      "guest_last_name": "Guest",
      "conf_number": "TEST123",
      "hotel_phone": "+1-501-555-1234",
      "destination_email": "test@example.com",
      "hotel_id": "hotel_001"
    }
  }'
```

Expected response:
```json
{
  "message": "Event accepted",
  "event_id": "uuid-v7",
  "status": "processing"
}
```

### Test 2: Verify Event in DynamoDB

```bash
aws dynamodb scan \
  --table-name ${APP_NAME}-events \
  --limit 5 \
  --region ${AWS_REGION}
```

### Test 3: Check CloudWatch Logs

```bash
# List log groups
aws logs describe-log-groups \
  --log-group-name-prefix /aws/lambda/${APP_NAME} \
  --region ${AWS_REGION}

# Tail logs for specific function
aws logs tail /aws/lambda/${APP_NAME}-scheduler --follow --region ${AWS_REGION}
```

### Test 4: Monitor Dashboard

```bash
# Open CloudWatch Dashboard
open "https://console.aws.amazon.com/cloudwatch/home?region=${AWS_REGION}#dashboards:name=${APP_NAME}-system"
```

## Phase 6: Production Hardening

### Enable X-Ray Tracing

All Lambda functions already have tracing enabled. Monitor traces:
```bash
# View X-Ray service map
open "https://console.aws.amazon.com/xray/home?region=${AWS_REGION}#/service-map"
```

### Configure Alarms

Alarms are automatically created by MonitoringStack. View them:
```bash
aws cloudwatch describe-alarms \
  --alarm-name-prefix ${APP_NAME} \
  --region ${AWS_REGION}
```

### Enable Detailed Monitoring

```bash
# CloudWatch Logs Insights query for errors
aws logs start-query \
  --log-group-name /aws/lambda/${APP_NAME}-scheduler \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/' \
  --region ${AWS_REGION}
```

### Set Up SNS Notifications

```bash
# Create SNS topic for alarms
SNS_TOPIC_ARN=$(aws sns create-topic \
  --name ${APP_NAME}-alerts \
  --region ${AWS_REGION} \
  --query 'TopicArn' \
  --output text)

# Subscribe email
aws sns subscribe \
  --topic-arn ${SNS_TOPIC_ARN} \
  --protocol email \
  --notification-endpoint your-email@example.com \
  --region ${AWS_REGION}

# Update CloudWatch alarms to use SNS (manual step in console or via CLI)
```

## Troubleshooting

### Issue: CDK Bootstrap Fails

```
Error: User is not authorized to perform: cloudformation:CreateStack
```

**Solution**: Ensure IAM user/role has CloudFormation and S3 permissions:
```json
{
  "Effect": "Allow",
  "Action": [
    "cloudformation:*",
    "s3:*",
    "iam:CreateRole",
    "iam:PutRolePolicy"
  ],
  "Resource": "*"
}
```

### Issue: Lambda Timeout

Check execution time in CloudWatch Logs. If consistently near timeout:
1. Increase memory allocation (more vCPU)
2. Optimize code (reduce I/O, use batching)
3. Increase timeout threshold

### Issue: DynamoDB Throttling

If seeing `ProvisionedThroughputExceededException`:
1. Check if on-demand mode (should auto-scale)
2. Check for hot partitions (uneven partition key distribution)
3. Enable DAX for caching

### Issue: EventBridge Events Not Arriving

1. Check EventBridge rule is enabled
2. Verify Event pattern matches your events
3. Check DLQ for failed deliveries

## Cleanup

### Destroy Stack (removes all AWS resources)

```bash
cd ../infrastructure
cdk destroy --force

# Or delete via AWS Console:
# CloudFormation → Stacks → FolioStack → Delete
```

**Warning**: This is irreversible. Data in DynamoDB and S3 will be deleted.

### Preserve Data While Removing Stack

```bash
# Backup DynamoDB tables before destroying
aws dynamodb create-backup \
  --table-name ${APP_NAME}-events \
  --backup-name ${APP_NAME}-events-backup-$(date +%s) \
  --region ${AWS_REGION}

# Then destroy
cdk destroy --force
```

## Next Steps

1. Deploy Lambda function code (see Lambda function templates)
2. Configure hotel data in DynamoDB
3. Run end-to-end test scenarios
4. Set up monitoring dashboards
5. Configure production email domains
6. Load test with expected call volume
