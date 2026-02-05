# Folio Request Automation System - Consolidated Specification

## Executive Summary

A system that automates folio (invoice) retrieval from hotels by:
1. Creating/importing folio request records with guest and reservation details
2. Batching requests by hotel phone number to minimize call frequency
3. Placing automated calls to request folios, processing multiple reservations per call
4. Providing API/UI for status tracking and call recording access
5. Supporting human operator intervention and escalation when needed

---

## System Scope

### What the System Does

For each folio request record, the system:
1. Uses the hotel phone number to place an automated call
2. Requests the hotel send the folio/invoice matching guest + reservation details
3. Processes multiple folio requests in a single call (when same hotel is called)
4. Updates each record with outcome status
5. Stores call recordings for audit and analysis

---

## Data Model

### Required Input Fields

| Field | Type | Purpose |
|-------|------|---------|
| Unique ID | String | Record identifier |
| Guest First Name | String | Guest identification |
| Guest Last Name | String | Guest identification |
| Reservation Confirmation Number | String | Reservation lookup |
| Check-in Date | Date | Reservation period |
| Check-out Date | Date | Reservation period |
| Hotel Phone Number | String | Calling target; used for batching |
| Destination Email | Email | **REQUIRED** - Where callee sends folio; provided to callee during call |

### Optional Input Fields

- Hotel Name
- Hotel Address

---

## Processing Behavior

### Scheduling & Batching

1. **Schedule**: System picks up all new records on a defined schedule
2. **Batching Logic**: Groups records by hotel phone number
   - **When same phone number appears multiple times**: Combine all folio requests into a **single call**
   - **When phone number is unique**: Place individual call
3. **Ordering**: Process folios oldest first within each batch
4. **Rationale**: Batching avoids irritating the callee with repeated calls to the same hotel

### Call Execution

#### Basic Flow
1. System initiates call to hotel phone number
2. For each batched folio request (oldest first):
   - Request folio for [Guest Name] + [Reservation #]
   - Provide destination email address to callee
3. Callee commits to sending folio to provided email
4. System records the status and updates each record

#### Call Duration Management

**Requirement**: Respect maximum call duration limits

**Algorithm**:
1. System estimates time needed to request all batched folios
2. **If estimated time ≤ max call duration**:
   - Request all folios in the single call
3. **If estimated time > max call duration**:
   - Request folios oldest-first until approaching max duration
   - Inform callee: *"The remaining folio cases will be sent to you via email with details"*
   - Send remaining folio details via email asynchronously
   - Both completed folios (in call) and email-sent folios are recorded

### Status Outcomes

After each call, the system updates each folio record with one of the following statuses:

- **Could not connect** - No answer, line busy
- **Voicemail** - Left with voicemail
- **Asked to try later** - Callee requested callback (record callback window)
- **Reservation not found** - Hotel couldn't find reservation
- **Agreed to send folio** - Hotel committed to sending folio to email
- **Refused / cannot share** - Hotel declined
- **Human follow-up required** - Escalation needed
- **Sent via email** - Folio details sent via email (overflow from duration limit)

---

## Escalation Handling

### Real-Time Listening & Intervention

**Capability**: Human operators can:
- Listen in on ongoing calls in real-time via dedicated interface
- Join/take over a call if needed

**Use Cases**:
- Compliance issues requiring human judgment
- Complex guest situations
- Hotel disputes or communication breakdowns

### Mid-Batch Escalation

**Scenario**: During a batched call, escalation needed for folio N of M

**Option 1 (Recommended - Efficiency Focused)**:
1. Escalate the current folio to human operator or supervisor
2. Inform callee: *"Additional information will be sent to you via email for this case"*
3. Continue requesting remaining folios in the batch
4. Record escalation reason and resolution

**Option 2 (Thoroughness Focused)**:
1. Inform callee: *"We'll arrange a new call to confirm details for this case"*
2. Move to next folio in batch
3. Schedule follow-up call for escalated case
4. Record escalation reason and follow-up commitment

**Implementation Note**: Log which option was used, reason for escalation, and operator action for audit trail.

---

## Call Recording & Audit

### Recording Requirements

- **All calls recorded** automatically
- **Storage**: Call recordings stored and accessible for later analysis
- **Per-Record Reference**: Each folio record in a batched call references the same recording
- **Audit Trail**: Access to recordings available via API/UI with appropriate access controls

### Operator Access

- Operators can retrieve and review call recordings
- Recordings used for:
  - Compliance verification
  - Quality assurance
  - Dispute resolution
  - Training

---

## Guardrails & Controls

### Harassment & Retry Rules

- **Retry limits**: Maximum number of retry attempts per folio request
- **Spacing rules**: Minimum time between retry attempts
- **Hotel-level caps**: Maximum retry calls per hotel within time window
- **Purpose**: Prevent harassing hotels while ensuring persistence

### Call Controls

- **Maximum call duration**: Hard limit on single call length
- **Maximum hold time**: Limit per hold period during call
- **Escalation triggers**: Automatic escalation if limits exceeded
- **Purpose**: Prevent unnecessarily long calls; protect system resources

### Concurrency Limits

- **Concurrent calls**: Maximum number of simultaneous calls
- **Purpose**: Manage load and ensure system stability

### Security & Privacy

- **Guest data handling**: Controlled access to PII (names, confirmation numbers)
- **Call data retention**: Define retention policies for recordings
- **Access control**: Only authorized operators can listen to calls or access guest data
- **Compliance**: Ensure adherence to data protection regulations

---

## System Interfaces

### API/UI - Status & Audit

**Consumers**: Hotel support team, operations, compliance

**Capabilities**:
- Fetch current status of any folio request record
- View call recording associated with a record
- View audit trail (status changes, operator notes, escalations)
- Filter by hotel, date range, status, guest name
- Export reports for analysis

### Real-Time Listening Interface

**Consumers**: Authorized human operators

**Capabilities**:
- View list of ongoing calls
- Listen in real-time on selected call
- Join/take over call with single action
- Leave notes/escalation reason
- End call or return to system

---

## Implementation Priorities

### Phase 1 - Core
- [ ] Record creation/import
- [ ] Basic call batching by phone number
- [ ] Call execution with oldest-first ordering
- [ ] Status recording (basic outcomes)
- [ ] Call recording storage
- [ ] Status API endpoint

### Phase 2 - Optimization & Guardrails
- [ ] Call duration estimation and email overflow
- [ ] Retry logic with spacing and caps
- [ ] Concurrency limits
- [ ] UI for status tracking
- [ ] Basic escalation (human flag)

### Phase 3 - Advanced
- [ ] Real-time listening interface
- [ ] Mid-call operator intervention
- [ ] Advanced escalation workflows
- [ ] Analytics dashboard
- [ ] Compliance reporting

---

## Clarifications Summary

| Issue | Resolution |
|-------|-----------|
| Email destination field | **REQUIRED input** - provided at record creation, given to callee during call |
| Batching strategy | **Batch same phone numbers** into single call; separate calls for unique numbers |
| Call duration overflow | Process oldest-first; if exceeds max, notify callee remaining sent via email |
| Real-time listening | Separate operator interface + all calls recorded for analysis |
| Mid-batch escalation | Either: (1) email remaining + continue, or (2) schedule callback + continue |

