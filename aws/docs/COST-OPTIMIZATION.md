# Cost Optimization Guide

## Cost Breakdown (Monthly, ~1000 calls/day)

| Service | Usage | Monthly Cost | Annual Cost |
|---------|-------|--------------|-------------|
| **Lambda** | 50M invocations, 500K GB-seconds | $50 | $600 |
| **DynamoDB** | On-demand, ~100K WCU, 50K RCU | $40 | $480 |
| **S3** | 10TB recordings, lifecycle policies | $15 | $180 |
| **EventBridge** | 500K events | $5 | $60 |
| **SQS** | 50K messages | <$1 | <$12 |
| **Secrets Manager** | 4 secrets | $4 | $48 |
| **CloudWatch** | Logs, dashboards, alarms | $5 | $60 |
| **Data Transfer** | Out to Twilio, Eleven Labs | $20 | $240 |
| **Step Functions** | 1M state transitions | $25 | $300 |
| **Miscellaneous** | KMS, X-Ray, etc. | $5 | $60 |
| **TOTAL** | | **~$170/month** | **~$2,040/year** |

## Cost Optimization Strategies

### 1. Lambda Optimization

#### Current Savings
- ✅ ARM64 architecture: **20% cost savings** vs x86
- ✅ Appropriate memory allocation: Avoid over-provisioning
- ✅ Reserved concurrency: Only for critical functions (Scheduler)

#### Additional Opportunities

**Reduce invocations**:
```bash
# Use EventBridge filtering instead of Lambda filtering
# Before: Lambda processes all events
# After: EventBridge filters, Lambda only processes relevant events

# Example EventBridge Rule:
{
  "EventPattern": {
    "source": ["folio.scheduler"],
    "detail-type": ["RecordQueued"],
    "detail": {
      "retry_attempt": [1]  # Only first attempt
    }
  }
}
# Saves: ~200K invocations/month = $4/month
```

**Lambda layer caching**:
- Pre-package dependencies in Lambda Layer
- Reduces cold start time and memory usage
- Saves: ~$2/month

**Remove unnecessary logging**:
- Log only errors and warnings in production
- Use sampling for debug logs (1 in 100 requests)
- Saves: $2-5/month

#### Estimated Savings
- Better filtering: $4/month
- Layer optimization: $2/month
- Logging reduction: $3/month
- **Total**: $9/month (5% savings)

### 2. DynamoDB Optimization

#### Current Savings
- ✅ On-demand pricing: Pay per request, no over-provisioning
- ✅ DynamoDB TTL: Auto-delete expired call context

#### Additional Opportunities

**Switch to Provisioned with Auto-scaling**:
```bash
# After 3 months of production data:
# Analyze usage patterns
# Switch high-volume tables to provisioned + auto-scaling
# Savings: 30-40% for predictable workloads

# Example: Event Store with 150 WCU baseline
# On-demand: $40/month (1B writes)
# Provisioned: $25/month + $2/month auto-scaling = $27/month
# Savings: $13/month
```

**DAX Cluster** (cache layer):
- Cost: $50-150/month for small cluster
- Benefit: 50-90% reduction in DynamoDB reads
- Break-even: Yes, if read-heavy workload

**Enable Kinesis Data Streams for Event Store**:
- Replace DynamoDB Streams
- Cost: ~$40/month
- Benefit: Better for high-volume event streaming
- Only if >10K events/second

#### Estimated Savings
- Provisioned + auto-scaling: $13/month (after ramp-up)
- DAX (if needed): Break-even to positive ROI
- **Total**: $13/month potential (33% reduction)

### 3. S3 Optimization

#### Current Configuration
- ✅ Intelligent-Tiering: Auto-moves objects to cheaper storage
- ✅ Lifecycle policies: Glacier after 1 year
- ✅ Block public access: Security and prevents accidental costs

#### Additional Opportunities

**S3 Intelligent-Tiering Archive**:
```bash
# Current: Intelligent-Tiering Standard
# Cost: $0.0125/GB/month

# Enhanced: Enable Archive tier (after 180 days)
# Cost: $0.004/GB/month
# Savings: ~$5/month for 1TB

# Tradeoff: 3-5 hour retrieval time (acceptable for archived calls)
```

**S3 Batch Operations for cleanup**:
- Bulk delete very old recordings (>5 years)
- Saves storage, helps with compliance
- Cost: Minimal (per-object fee only)

**S3 Select instead of full file retrieval**:
- Query metadata from S3 without downloading
- Relevant for email attachment index
- Saves: ~$1-2/month

#### Estimated Savings
- Archive tier: $5/month
- Batch cleanup: $1/month (1-time effort)
- S3 Select: $2/month
- **Total**: $8/month

### 4. EventBridge Optimization

#### Current Savings
- ✅ Custom event bus: Cheaper than multiple buses
- ✅ Rule filtering: Reduce Lambda invocations

#### Additional Opportunities

**Consolidate similar events**:
```javascript
// Before: Separate rules for CallConnected, CallEnded, etc.
// Rule count: 9
// Cost: $5/month

// After: Single rule with EventPattern filtering
// Rule count: 1
// Cost: <$1/month
// Savings: $4/month
```

**Archive events for audit** (optional):
- Send all events to S3 for compliance
- Cost: Minimal with EventBridge Archive feature
- Benefit: Audit trail, replay capability

#### Estimated Savings
- Rule consolidation: $4/month
- **Total**: $4/month

### 5. Data Transfer Optimization

#### Current Costs
- Outbound to Twilio: ~100GB/month = $15/month
- Outbound to Eleven Labs: ~10GB/month = $2/month

#### Opportunities

**Use VPC Endpoints** (advanced):
- Bypass internet gateway
- Reduces data transfer costs
- Cost: $7/endpoint/month
- Break-even: Not worth for current volume

**Compress recordings before upload**:
- MP3 encoding: 80-90% compression
- Cost: Lambda compute + time to encode
- Benefit: $10-15/month savings
- Break-even: Yes for 1000+ calls/day

**Cache Eleven Labs responses**:
- Store intent detection results
- Avoid re-processing similar inputs
- Savings: $2-5/month

#### Estimated Savings
- MP3 compression: $12/month
- Response caching: $4/month
- **Total**: $16/month

### 6. Step Functions Optimization

#### Current Costs
- Call Handler: ~1M state transitions/month = $25/month

#### Opportunities

**Use Express Step Functions** (where applicable):
```bash
# Standard: $0.000025 per state transition
# Express: $0.000001 per state transition
# Savings: 96% for short, high-volume workflows

# But: Only for workflows <5 minutes
# Call Handler is 10 minutes max, but wait states consume transitions
```

**Optimize state transitions**:
```json
// Before: Pass state → Lambda → Pass state → Lambda
// Transitions: 4

// After: Combine with Map state
// Transitions: 2
// Savings: 50% for certain workflows
```

#### Estimated Savings
- State optimization: $5-10/month
- **Total**: $8/month

### 7. CloudWatch Optimization

#### Current Costs
- Log storage: ~5GB/month = $5/month

#### Opportunities

**Reduce log retention**:
```bash
# Current: 7 days
# Cost: $0.50/GB-month

# Optimization: 3 days for dev, 14 days for prod
# Savings: $1-2/month
```

**Use S3 export for long-term**:
- Archive logs to S3 after 7 days
- Cost: Minimal ($0.50-1/month)
- Benefit: Compliance, audit trail

**Disable detailed monitoring**:
- Enable only for production critical functions
- Reduces CloudWatch Metrics API calls
- Savings: <$1/month

#### Estimated Savings
- Log retention tuning: $1/month
- **Total**: $1/month

## Implementation Roadmap

### Phase 1: Quick Wins (Week 1) - $20/month savings
- [ ] EventBridge rule consolidation: $4
- [ ] Lambda logging optimization: $3
- [ ] S3 Select for metadata: $2
- [ ] Better DynamoDB filtering: $4
- [ ] CloudWatch log retention: $1
- [ ] Secrets Manager: Pre-expire unused: $2
- [ ] Lambda layer optimization: $2
- [ ] EventBridge rule filtering: $2

### Phase 2: Structural Changes (Week 2-4) - $35/month additional
- [ ] MP3 compression for recordings: $12
- [ ] Switch DynamoDB to provisioned (after monitoring): $13
- [ ] S3 Intelligent-Tiering Archive: $5
- [ ] Step Functions state optimization: $8
- [ ] Caching for Eleven Labs: $4

### Phase 3: Advanced Optimizations (Month 2-3) - $20/month additional
- [ ] DAX cluster for read-heavy tables: TBD
- [ ] Consolidate log streams: $3
- [ ] S3 Batch Operations cleanup: $1 + $16 (one-time)
- [ ] CloudFront for static assets: Not applicable
- [ ] Reserved capacity for DynamoDB (if provisioned): $10-15

## Cost Monitoring

### CloudWatch Cost Dashboard

```bash
# Create cost dashboard
aws cloudwatch put-metric-alarm \
  --alarm-name EstimatedMonthlyFolioACost \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --period 86400 \
  --statistic Maximum \
  --threshold 200 \
  --alarm-actions arn:aws:sns:region:account:topic
```

### Monthly Cost Review

1. Download AWS Cost Explorer data
2. Compare actual vs estimated costs
3. Identify high-cost services
4. Investigate anomalies
5. Adjust thresholds/configs as needed

### Cost Alerts

```bash
# Alert if monthly cost exceeds $250
aws budgets create-budget \
  --account-id 123456789012 \
  --budget '{
    "BudgetName": "FolioManagement",
    "BudgetLimit": {"Amount": "250", "Unit": "USD"},
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }'
```

## Break-Even Analysis

### When to Invest in Optimization

| Optimization | Cost | Monthly Savings | Break-Even |
|--------------|------|-----------------|-----------|
| MP3 Compression | $20 (one-time setup) | $12 | 2 weeks |
| DAX Cluster | $100/month | $20/month (read reduction) | 5 months |
| Provisioned DynamoDB | $0 (switch at any time) | $13 | Immediate |
| S3 Archive tier | $0 (automatic) | $5 | Immediate |
| VPC Endpoints | $7/endpoint/month | $5/month savings | Never (unless very high traffic) |

## Recommended Path

1. **Day 1**: Implement quick wins (20 minutes) = **$20/month savings**
2. **Week 1**: Monitor and verify changes
3. **Week 2**: Implement structural changes = **$35/month additional**
4. **Month 2**: Based on production metrics, decide on advanced options
5. **Ongoing**: Monthly cost review and optimization

## Summary

- **Current**: ~$170/month
- **After Quick Wins**: ~$150/month (11% reduction)
- **After Structural**: ~$115/month (32% reduction)
- **After Advanced**: ~$95/month (44% reduction)

**Potential annual savings: $900/year** with minimal engineering effort.

Focus on quick wins first, then assess production metrics before committing to structural changes.
