# Folio System - Design & Technical Architecture

This directory contains comprehensive technical and architectural documentation for the Folio automation system.

## Documents Overview

### Core Architecture
- **[Technical-Architecture-HLD.md](./Technical-Architecture-HLD.md)** - Main high-level design document
  - Architecture principles (event-driven, modular, immutable events)
  - Short-term vs long-term deployment models
  - Core component interfaces
  - Provider abstractions (Voice LLM, Telephony, Email)
  - Event schema design
  - Queue design (logical construct)
  - State management via events
  - LLM context management (templates, TOONs, JSON schemas)

- **[Event-Catalog.md](./Event-Catalog.md)** - Complete event definitions
  - Standard event structure
  - All 40+ event types defined
  - Event examples with sample data
  - Event versioning strategy
  - Event retention policies

### Component Designs

Individual component specifications with interfaces, flows, and configurations:

1. **[01-Scheduler.md](./components/01-Scheduler.md)**
   - Picks up new records on schedule
   - Manages callback rescheduling
   - Manages verification scheduling

2. **[02-Batching-Engine.md](./components/02-Batching-Engine.md)**
   - Groups records by hotel phone
   - Estimates call duration
   - Detects and manages overflow

3. **[03-Call-Handler.md](./components/03-Call-Handler.md)**
   - Orchestrates voice interactions
   - Manages complete call lifecycle
   - Delegates to specialized handlers

4. **[04-IVR-Navigator.md](./components/04-IVR-Navigator.md)**
   - Detects IVR systems
   - Navigates automated menus via DTMF
   - Handles IVR failures and fallbacks

5. **[05-Voice-Analyzer.md](./components/05-Voice-Analyzer.md)**
   - Transcribes speech
   - Detects intent (agree/refuse/callback)
   - Extracts callback times
   - Detects voicemail

6. **[06-Email-Composer.md](./components/06-Email-Composer.md)**
   - Composes professional folio request emails
   - Sends via email provider
   - Manages email templates
   - Handles retries

7. **[07-Email-Monitor.md](./components/07-Email-Monitor.md)**
   - Monitors client inbox for responses
   - Correlates emails to requests
   - Handles attachments
   - Manages timeouts

8. **[08-Data-Extractor.md](./components/08-Data-Extractor.md)**
   - Extracts folio data from emails
   - Processes attachments and OCR
   - Uses extraction templates
   - Validates extracted data

9. **[09-Callback-Manager.md](./components/09-Callback-Manager.md)**
   - Schedules callbacks
   - Manages callback queues
   - Schedules verifications
   - Enforces business hours

10. **[10-Status-Manager.md](./components/10-Status-Manager.md)**
    - Maintains record status via events
    - No direct state queries
    - Provides query projections
    - Audit trail management

## Architecture Principles

### Event-Driven
- All state changes are immutable events
- Event log is source of truth
- State reconstructed from events, never queried directly
- Complete audit trail for compliance

### Component Modularity
- All components defined via logical interfaces
- Swappable implementations
- Single responsibility principle
- Independent deployment ready

### Provider Abstractions
- Voice LLM abstraction (current: Eleven Labs, future: custom)
- Telephony abstraction (current: Twilio, future: other providers)
- Email abstraction (SMTP/IMAP or Graph API)
- Easy provider switching without code changes

### Short-term vs Long-term
**Short-term (Monolithic):**
- Single deployable container
- In-memory queues with persistence backing
- All components in same process
- SQLite/PostgreSQL event store
- Fast inter-component communication

**Long-term (Distributed):**
- Microservices architecture
- External message broker (Kafka/RabbitMQ)
- Independent service deployment
- Distributed event store
- Horizontal scaling per service

### Queue as Logical Construct
- IQueue interface for abstraction
- Short-term: In-memory with file persistence
- Long-term: Actual message broker
- No direct coupling to queue implementation

### State Management
- Event sourcing pattern
- Aggregate pattern per FolioRequest
- Snapshots for optimization (future)
- Query projections for UI/API
- No state update queries

### LLM Context Management
- Templates for predefined interactions
- TOON (Tree Of Observed Nodes) for conversation state
- JSON schemas for structured extraction
- Context window management
- Fallback to template-matching when LLM unavailable

## Key Design Decisions

### 1. Immutable Events
- **Why**: Complete audit trail, replay capability, eventual consistency
- **Trade-off**: More storage, event replay latency
- **Mitigation**: Snapshots, efficient indexing

### 2. Inline Events for Decisions
- **Why**: Asynchronous by design, clear decision flow
- **Trade-off**: More complex error handling
- **Mitigation**: Event correlation and causation tracking

### 3. Provider Abstractions
- **Why**: Technology flexibility, future LLM/telephony changes
- **Trade-off**: Extra abstraction layer
- **Mitigation**: Interfaces are minimal, no performance impact

### 4. No Direct State Queries
- **Why**: Ensures consistency, enables event replay, compliance
- **Trade-off**: Must rebuild state from events
- **Mitigation**: Query projections, caching, snapshots

### 5. Logical Queues Initially
- **Why**: Simple deployment, no external dependencies
- **Trade-off**: Monolithic, vertical scaling only
- **Mitigation**: Clear queue interface for future distribution

## Integration Points

### With Specification
- Components map to logical architecture in [Folio-architecture.md](../Folio-architecture.md)
- Events correspond to spec status outcomes
- Component interfaces define data flow
- Deployment models align with functional groups

### External Systems
- **Voice LLM**: Eleven Labs (short-term) or custom (long-term)
- **Telephony**: Twilio (short-term) or SIP/custom (long-term)
- **Email**: SMTP/IMAP or Microsoft Graph API
- **Event Store**: PostgreSQL/SQLite (short-term) or EventStoreDB/Kafka (long-term)

## Deployment

### Short-term Single Deployable
```
Docker Image:
  - Single application process
  - Embedded event store (SQLite + WAL)
  - In-memory queues with file backup
  - Provider clients included
  - ~50MB image size
```

### Configuration
- Environment variables for provider API keys
- Config files for component settings
- Event store location
- External service endpoints

### Health Checks
- Event store connectivity
- Provider connectivity
- Queue health
- Component status

## Scalability Path

1. **Phase 1**: Monolithic deployment (current architecture)
2. **Phase 2**: Modular monolith (same deployment, loose coupling)
3. **Phase 3**: Service extraction (independent services)
4. **Phase 4**: Distributed system (full microservices)

Each phase maintains the same interfaces and event schema.

## Security Considerations

### Event Encryption
- Events with PII encrypted at rest
- Separate key management
- Audit trail of key access

### Provider Credentials
- Stored in vault (HashiCorp/AWS Secrets)
- Rotated regularly
- Never in event log

### Access Control
- RBAC for operator interface
- API authentication via JWT
- Service-to-service via mTLS (long-term)

## Testing Strategy

### Unit Tests
- Component interfaces tested independently
- Mocked providers
- Event assertions

### Integration Tests
- Component interaction via events
- Full workflow scenarios
- Provider integration (mocked)

### E2E Tests
- Complete folio request lifecycle
- Real provider interaction (staging)
- Failure scenarios

## Monitoring & Observability

### Metrics
- Component latency
- Event processing rate
- Queue sizes
- Provider API health
- Error rates per component

### Logs
- Structured JSON logging
- Component name + operation
- Event ID for tracing
- Status transitions

### Traces
- OpenTelemetry instrumentation
- Correlation IDs across events
- Call/batch lifecycle tracing

### Events
- Event log is audit trail
- Query for investigations
- Metrics derived from events

## Navigation Map

```
📁 design/
├── 📄 README.md (this file)
├── 📄 Technical-Architecture-HLD.md (start here)
├── 📄 Event-Catalog.md (event reference)
└── 📁 components/
    ├── 📄 01-Scheduler.md
    ├── 📄 02-Batching-Engine.md
    ├── 📄 03-Call-Handler.md
    ├── 📄 04-IVR-Navigator.md
    ├── 📄 05-Voice-Analyzer.md
    ├── 📄 06-Email-Composer.md
    ├── 📄 07-Email-Monitor.md
    ├── 📄 08-Data-Extractor.md
    ├── 📄 09-Callback-Manager.md
    └── 📄 10-Status-Manager.md

📁 ../
├── 📄 Folio-spec-consolidated.md (functional spec)
├── 📄 Folio-architecture.md (logical architecture)
└── 📁 design/ (this directory - technical architecture)
```

## How to Use This Documentation

### For Implementation
1. Start with [Technical-Architecture-HLD.md](./Technical-Architecture-HLD.md)
2. Review component interface relevant to your task
3. Check [Event-Catalog.md](./Event-Catalog.md) for events to emit/consume
4. Implement using interfaces as contracts

### For Understanding Flow
1. Read component flow diagrams
2. Trace events through [Event-Catalog.md](./Event-Catalog.md)
3. Review Status Manager for state transitions
4. Check Call Handler for orchestration example

### For System Design
1. Review short-term and long-term architectures
2. Understand event-driven principles
3. Plan deployment strategy
4. Design monitoring and operations

### For Troubleshooting
1. Check component error handling sections
2. Review event correlation and causation
3. Examine Status Manager state transitions
4. Validate against event catalog

## Version Control

- This documentation version: 2026-02-06
- Aligned with specification version: 2026-02-06
- Event schema version: 1.0
- Component interface version: 1.0

## Next Steps

1. **Implementation Planning**: Use component interfaces for development sprints
2. **Team Alignment**: Review architecture with team before development
3. **Provider Integration**: Implement provider abstraction layers
4. **Testing Strategy**: Design tests using event assertions
5. **Deployment Automation**: Script short-term single deployable
6. **Monitoring Setup**: Instrument components for observability

