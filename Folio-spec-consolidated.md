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

### System Configuration (Per Client)

| Field | Type | Purpose |
|-------|------|---------|
| Client Email Address | Email | **REQUIRED** - From address for email requests; where hotel responds; system monitors this inbox |
| Hotel Destination Email | Email | Optional - Hotel's email where system sends folio request details if needed |

### Optional Input Fields

- Hotel Name
- Hotel Address
- Hotel Email Address (if known in advance)

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
2. **IVR/Voicemail Detection** (see IVR Handling section below)
3. If connected to person:
   - For each batched folio request (oldest first):
     - Request folio for [Guest Name] + [Reservation #]
   - Callee commits to sending folio
4. System records the status and updates each record

#### Email Alternative/Overflow Channel
When call is not feasible or as overflow from call duration limits:
1. System sends email to hotel's email address with:
   - Guest name, confirmation number, check-in/check-out dates
   - Request for folio/invoice details
   - **From address**: Client email (where hotel should respond)
2. Hotel receives request and responds to client email address
3. System monitors client email inbox
4. System receives response and extracts folio/billing information
5. System parses extracted data and updates folio record with details
6. Records status as "Folio Received - Email"

---

## IVR & Voicemail Handling

### IVR Detection & Navigation

**Scenario**: Hotel uses Interactive Voice Response (IVR) menu system

**System Capabilities**:

1. **IVR Detection**:
   - Detects when connected to automated IVR system (vs. human)
   - Analyzes audio to identify menu options
   - Example: *"Press 1 for Reservations, Press 2 for Billing, Press 3 for Front Desk"*

2. **DTMF Navigation**:
   - Sends appropriate DTMF tones (button presses) to navigate IVR
   - Hotel-specific mapping (configurable per hotel):
     - Which menu option leads to billing/folio requests
     - If routing varies: store preferred path for future calls
   - Example: Hotel A uses "Press 2 for Billing" → System sends DTMF "2"

3. **Menu Navigation Logging**:
   - Records which IVR options were pressed
   - Tracks menu path taken to reach person/billing
   - Logs in audit trail for quality assurance

### Voicemail Detection & Handling

**Scenario**: Call lands on voicemail system

**System Behavior**:

1. **Voicemail Detection**:
   - Analyzes audio characteristics to detect voicemail greeting
   - Records if voicemail was detected

2. **Voicemail Action Options**:

   **Option A - Leave Message**:
   - Leave pre-recorded message: *"This is an automated call requesting folio for [Guest Name], Confirmation #[###]. Please send to [email address]. Reference ID: [###]"*
   - Mark record status: **Voicemail - Message Left**
   - Reschedule for retry in defined timeframe (e.g., 24 hours)

   **Option B - Hang Up & Reschedule**:
   - Disconnect without leaving message (if configured)
   - Mark record status: **Voicemail - No Message Left**
   - Reschedule for retry in defined timeframe

### Callback Scheduling from Verbal Instructions

**Scenario**: Person answers but says *"Call back in 2 hours"* or *"We'll send tomorrow"*

**System Capabilities**:

1. **Callback Window Parsing**:
   - Voice recognition extracts timeframe from human speech
   - Understands variations:
     - "Call back in 2 hours" → Schedule in 2 hours
     - "Call back tomorrow" → Schedule for next business day
     - "Call back in 3 days" → Schedule 72 hours from now
     - "Try again after 5 PM" → Schedule after 5 PM today/tomorrow
     - "We'll send the folio by EOD" → Mark as pending, verify by end of day

2. **Callback Scheduling Logic**:
   - Creates a **Rescheduled** record with new target call time
   - Maintains original folio request context
   - Links rescheduled record to original for audit trail
   - Applies business hour rules (e.g., no calls before 8 AM or after 6 PM)

3. **Status Recording**:
   - Original record status: **Asked to try later - Callback Scheduled**
   - Callback time: Recorded in metadata
   - Reason: *"Person said call back in X"* (stored from voice)

### Handling "We'll Send" Commitments

**Scenario**: Hotel says *"We'll send the folio by tomorrow"* or *"via email in the morning"*

**System Behavior**:

1. **Pending Verification**:
   - Mark record status: **Pending Verification - Hotel Committed**
   - Set verification check time (e.g., 24 hours after call)

2. **Automatic Verification**:
   - At scheduled check time, system:
     - Sends reminder email to hotel
     - OR attempts follow-up call if email not received
   - If folio received: Mark **Agreed to Send - Received**
   - If no folio: Mark **Agreed to Send - Not Received** → Escalate

### Status Outcomes - IVR/Voicemail Extended

Updated status list including IVR scenarios:

- **Could not connect** - No answer, line busy, failed to connect
- **Voicemail - Message Left** - Reached voicemail, left detailed message
- **Voicemail - No Message Left** - Reached voicemail, hung up per config
- **Asked to try later - Callback Scheduled** - Person gave callback time/window
- **Pending Verification - Hotel Committed** - Hotel said they'll send, awaiting receipt
- **IVR Navigation Failed** - Could not navigate IVR successfully
- **Reservation not found** - Hotel/person couldn't find reservation
- **Agreed to send folio** - Hotel committed, will send to email
- **Refused / cannot share** - Hotel declined
- **Human follow-up required** - Escalation needed
- **Sent via email** - Folio details sent via email (overflow from duration limit)

### IVR Configuration Per Hotel

**Hotel-Specific Settings**:

- Hotel phone number
- Known IVR menu structure (if available)
- DTMF sequence to reach billing/folio department
  - Example: "Press 2 → Press 1" for Hotel A
  - Example: "Press 3" for Hotel B
- Business hours for calling
- Callback time constraints (e.g., "call back after 2 PM only")
- Voicemail preference (leave message vs. hang up)
- Language of IVR (for future multi-language support)

**Learning/Adaptation**:
- System can log successful navigation paths
- Operators can update IVR sequences based on real calls
- Configuration improves over time with successful calls



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

After each call or email interaction, the system updates each folio record with one of the following statuses:

**From Call Interactions:**
- **Could not connect** - No answer, line busy, failed to connect
- **Voicemail - Message Left** - Reached voicemail, left detailed message with folio request
- **Voicemail - No Message Left** - Reached voicemail, hung up per configuration
- **IVR Navigation Failed** - Could not navigate IVR successfully to reach person
- **Asked to try later - Callback Scheduled** - Person gave specific callback time/window; system will retry automatically
- **Pending Verification - Hotel Committed** - Hotel said they'll send folio via email; awaiting receipt
- **Reservation not found** - Hotel/person couldn't find reservation in their system
- **Agreed to send folio** - Hotel committed to sending folio
- **Refused / cannot share** - Hotel declined to provide folio
- **Sent via email - Overflow** - Folio request sent via email (overflow from call duration limit)
- **Human follow-up required** - Escalation needed due to complexity or system limitation

**From Email Interactions:**
- **Folio Request Sent - Awaiting Response** - Email sent to hotel requesting folio; monitoring for response
- **Folio Received - Email** - Hotel responded with folio/billing information; data extracted and recorded
- **Email Response - Unable to Extract** - Hotel responded but data could not be automatically extracted; escalate for manual review
- **Email - No Response** - Email sent but no response received within timeout period; escalate

---

## Email-Based Folio Requests & Extraction

### Email Request Flow

**Triggered When:**
- Hotel provides email address instead of phone
- Call duration would exceed maximum (overflow)
- Hotel requests email communication
- Voicemail message left with email request

**Process:**

1. **Email Composition**:
   - System composes email with:
     - Guest name, confirmation number
     - Check-in and check-out dates
     - Clear request for folio/invoice
     - Reference ID for tracking
   - **From**: Client email address (where hotel will respond)
   - **To**: Hotel's email address

2. **Email Monitoring**:
   - System monitors client email inbox
   - Checks for responses to folio requests
   - Tracks response timeframe and correlates to request

3. **Response Extraction**:
   - When response received, system:
     - Extracts folio/billing information from email body and attachments
     - Parses document attachments (PDF, image) if present
     - Extracts relevant fields: folio number, charges, dates, amounts
     - Stores extracted data with record

4. **Record Update**:
   - Updates folio record with extracted information
   - Records status as "Folio Received - Email"
   - Links to email correspondence for audit trail
   - Marks record as complete

### Extraction Capabilities

**Automatic Extraction Includes:**
- Folio/invoice number
- Guest name verification
- Room number (if provided)
- Check-in and check-out dates
- Itemized charges and total amount
- Payment method/terms
- Any special notes or conditions

**Handling Incomplete/Complex Responses:**
- If data cannot be automatically extracted, status: "Email Response - Unable to Extract"
- Route to human operator for manual review
- Store raw email for operator reference

### Email Monitoring Configuration

**Per Hotel:**
- Hotel's email address (where request is sent)
- Email subject and body templates
- Expected response timeframe
- Timeout period before escalation
- Document attachment formats expected (PDF, image, etc.)

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

## System Architecture & Logical Components

See detailed logical architecture diagrams in [Folio-architecture.md](./Folio-architecture.md):
- System Architecture (overall component relationships)
- Critical Process Flow (call execution workflow with IVR handling)
- IVR Handling Flow (detailed voice decision tree)
- Component Interaction Flow (sequence of operations)
- Record Lifecycle (record state transitions)

---

## Clarifications Summary

| Issue | Resolution |
|-------|-----------|
| Email configuration | **Client email** (from address, system-managed): where hotel responds; **Hotel email** (destination, optional): where system sends folio request |
| Email-based folio requests | System sends email to hotel with guest details + folio request; monitors client email for response; extracts folio information from received email |
| Data extraction from email | System extracts folio number, charges, dates, amounts from email body or attachments; escalates if extraction fails |
| Batching strategy | **Batch same phone numbers** into single call; separate calls for unique numbers |
| Call duration overflow | Process oldest-first; if exceeds max, send folio request via email instead |
| Real-time listening | Separate operator interface + all calls recorded for analysis |
| Mid-batch escalation | Either: (1) email remaining + continue, or (2) schedule callback + continue |
| IVR handling | System detects IVR vs. human vs. voicemail; navigates IVR menus; leaves voicemail messages; parses callback timeframes |
| Callback scheduling | Extracts callback time from voice responses; reschedules call at requested time; applies business hour rules |
| Commitment verification | Tracks hotel commitments ("we'll send by EOD"); schedules verification check at expected delivery time |

