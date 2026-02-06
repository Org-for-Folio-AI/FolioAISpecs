# Folio System - Logical Architecture & Flows

## Overview

This document presents the logical architecture and process flows of the Folio automation system. These are conceptual diagrams for stakeholders to understand system components, interactions, and decision logic. This is **not** a technical implementation topology or system design specification.

---

## System Architecture

Logical view of system components and how they relate:

```mermaid
%%{init: {'fontSize': 18, 'fontFamily': 'arial'}}%%
graph TB
    subgraph Input["Input Layer"]
        A["Record Creation/Import"]
        B["Data Sources"]
    end

    subgraph Processing["Processing Layer"]
        C["Scheduler"]
        D["Batching Engine"]
        E["Call Optimizer"]
        F["Call Handler"]
    end

    subgraph Intelligence["Intelligence Layer"]
        F1["Connection Analyzer"]
        F2["IVR Navigator"]
        F3["Voice Analyzer"]
        F4["Callback Parser"]
    end

    subgraph Decision["Decision & Action Layer"]
        G["Escalation Logic"]
        H["Overflow Handler"]
        I1["Callback Manager"]
    end

    subgraph Storage["Data Layer"]
        I2["Hotel Configuration"]
        J["Call Recordings"]
        K1["Scheduling Queue"]
    end

    subgraph Output["Output & Notifications"]
        I["Status Manager"]
        K["Notification Service"]
    end

    subgraph Email["Email Layer"]
        E1["Email Composer"]
        E2["Email Monitor"]
        E3["Data Extractor"]
    end

    subgraph Access["Access & Visibility"]
        L["Status API & UI"]
        M["Operator Interface"]
    end

    A --> C
    B --> C
    C --> D
    D --> E
    E --> F
    F --> F1
    F1 -->|Human| G
    F1 -->|IVR| F2
    F1 -->|Voicemail| F3
    F2 --> I2
    F2 --> G
    F3 --> F4
    F4 --> I1
    F3 --> G
    F4 --> I1
    H --> E1
    E1 --> K
    E1 --> I2
    E2 --> E3
    E3 --> I
    I1 --> K1
    G --> M
    G --> I
    K --> I
    K1 --> C
    F --> H
    F --> I
    F --> J
    I --> L
    J --> L
    J --> M
    E2 --> E3

    style A stroke:#003d82,fill:#ffffff,stroke-width:3px,font-size:16px
    style B stroke:#003d82,fill:#ffffff,stroke-width:3px,font-size:16px
    style C stroke:#e65100,fill:#ffffff,stroke-width:3px,font-size:16px
    style D stroke:#e65100,fill:#ffffff,stroke-width:3px,font-size:16px
    style E stroke:#e65100,fill:#ffffff,stroke-width:3px,font-size:16px
    style F stroke:#e65100,fill:#ffffff,stroke-width:3px,font-size:16px
    style F1 stroke:#d49300,fill:#ffffff,stroke-width:3px,font-size:16px
    style F2 stroke:#d49300,fill:#ffffff,stroke-width:3px,font-size:16px
    style F3 stroke:#d49300,fill:#ffffff,stroke-width:3px,font-size:16px
    style F4 stroke:#d49300,fill:#ffffff,stroke-width:3px,font-size:16px
    style E1 stroke:#1b5e20,fill:#ffffff,stroke-width:3px,font-size:16px
    style E2 stroke:#1b5e20,fill:#ffffff,stroke-width:3px,font-size:16px
    style E3 stroke:#1b5e20,fill:#ffffff,stroke-width:3px,font-size:16px
    style G stroke:#4a148c,fill:#ffffff,stroke-width:3px,font-size:16px
    style H stroke:#4a148c,fill:#ffffff,stroke-width:3px,font-size:16px
    style I1 stroke:#4a148c,fill:#ffffff,stroke-width:3px,font-size:16px
    style I2 stroke:#00695c,fill:#ffffff,stroke-width:3px,font-size:16px
    style I stroke:#1b5e20,fill:#ffffff,stroke-width:3px,font-size:16px
    style J stroke:#1b5e20,fill:#ffffff,stroke-width:3px,font-size:16px
    style K stroke:#1b5e20,fill:#ffffff,stroke-width:3px,font-size:16px
    style K1 stroke:#1b5e20,fill:#ffffff,stroke-width:3px,font-size:16px
    style L stroke:#b71c1c,fill:#ffffff,stroke-width:3px,font-size:16px
    style M stroke:#b71c1c,fill:#ffffff,stroke-width:3px,font-size:16px
```

### Component Descriptions

- **Scheduler**: Picks up new records on defined intervals; triggers calls and email requests
- **Batching Engine**: Groups records by hotel phone number
- **Call Optimizer**: Estimates call duration and determines request strategy
- **Call Handler**: Manages the actual communication with hotels via phone
- **Connection Analyzer**: Determines if connection is with person, IVR system, or voicemail
- **IVR Navigator**: Handles navigation of automated phone systems
- **Voice Analyzer**: Analyzes spoken responses and voicemail
- **Callback Parser**: Extracts timing information from callback requests
- **Escalation Logic**: Routes complex cases to human operators
- **Overflow Handler**: Manages requests that exceed call duration limits; routes to email
- **Callback Manager**: Schedules and tracks follow-up calls
- **Email Composer**: Creates and sends folio request emails to hotels
- **Email Monitor**: Monitors client email inbox for hotel responses
- **Data Extractor**: Extracts folio/billing information from email responses; parses attachments
- **Status Manager**: Updates record status based on call and email outcomes
- **Notification Service**: Sends emails and notifications
- **Call Recordings**: Stores and makes available all call audio
- **Hotel Configuration**: Stores hotel-specific details (IVR paths, email addresses, preferences)
- **Scheduling Queue**: Maintains callbacks, verification checks, and email response timeouts
- **Status API & UI**: Provides visibility to staff and operators
- **Operator Interface**: Allows real-time listening, intervention, and manual folio extraction review

---

## Critical Process Flow

How the system processes folio requests from start to finish:

```mermaid
%%{init: {'fontSize': 18, 'fontFamily': 'arial'}}%%
flowchart TD
    Start([New Folio Records]) --> Schedule["Scheduler picks up<br/>new records"]

    Schedule --> Fetch["Fetch records from<br/>input queue"]
    Fetch --> Group["Group by hotel<br/>phone number"]

    Group --> Batch{Records to<br/>process?}
    Batch -->|No| End1([Cycle complete])
    Batch -->|Yes| Estimate["Estimate total time<br/>for batch"]

    Estimate --> DurationCheck{Time fits<br/>in limit?}

    DurationCheck -->|Yes| CallHotel["Call hotel"]
    DurationCheck -->|No| PlanOverflow["Plan to send<br/>overflow via email"]

    CallHotel --> DetectConn{What<br/>answered?}
    PlanOverflow --> CallHotel

    DetectConn -->|No answer| NoConn["Record: Could not connect<br/>Schedule retry"]
    DetectConn -->|Voicemail| VMBranch["Voicemail branch"]
    DetectConn -->|IVR Menu| IVRBranch["IVR branch"]
    DetectConn -->|Human| HumanBranch["Human branch"]

    VMBranch --> VMChoice{Action}
    VMChoice -->|Leave message| LeaveMsg["Record message<br/>with folio details"]
    VMChoice -->|Hang up| HangVM["Disconnect"]
    LeaveMsg --> VMStatus["Record: VM - Message Left<br/>Schedule retry"]
    HangVM --> VMStatus2["Record: VM - No Message<br/>Schedule retry"]

    IVRBranch --> CheckConfig["Check hotel IVR<br/>configuration"]
    CheckConfig --> Navigate["Navigate menu<br/>to reach billing"]
    Navigate --> NavSuccess{Reached<br/>person?}
    NavSuccess -->|No| IVRFail["Record: IVR Navigation Failed<br/>Escalate"]
    NavSuccess -->|Yes| HumanBranch

    HumanBranch --> RequestFolio["Request folio<br/>Guest info + Email"]
    RequestFolio --> AnalyzeResponse["Analyze response"]
    AnalyzeResponse --> ResponseType{Response<br/>type?}

    ResponseType -->|Agreed| AgreedStatus["Record: Agreed to send"]
    ResponseType -->|Not found| NotFound["Record: Reservation not found"]
    ResponseType -->|Refused| Refused["Record: Refused"]
    ResponseType -->|Call back| CallbackBranch["Extract callback time<br/>Schedule follow-up"]
    ResponseType -->|We'll send| CommitBranch["Record commitment<br/>Schedule verification"]

    NoConn --> CheckMore{More folios<br/>in batch?}
    VMStatus --> CheckMore
    VMStatus2 --> CheckMore
    IVRFail --> CheckMore
    AgreedStatus --> CheckMore
    NotFound --> CheckMore
    Refused --> CheckMore
    CallbackBranch --> CheckMore
    CommitBranch --> CheckMore

    CheckMore -->|Yes| RequestFolio
    CheckMore -->|No| FinalSteps["Record call audio<br/>Update all records"]

    FinalSteps --> EmailCheck{Overflow<br/>or email<br/>needed?}
    EmailCheck -->|Yes| SendEmail["Compose & send folio<br/>request email to hotel<br/>From: Client email"]
    EmailCheck -->|No| Complete["Mark batch complete"]

    SendEmail --> EmailMonitor["Add to email<br/>monitoring queue"]
    EmailMonitor --> WaitResponse["Monitor client inbox<br/>for hotel response"]
    WaitResponse --> ResponseReceived{Response<br/>received?}

    ResponseReceived -->|Yes| ExtractData["Extract folio/billing<br/>information from email"]
    ResponseReceived -->|No| Timeout["Timeout - mark<br/>as no response<br/>Escalate"]

    ExtractData --> ExtractionSuccess{Data<br/>extracted<br/>successfully?}
    ExtractionSuccess -->|Yes| RecordExtracted["Record: Folio Received - Email<br/>Store extracted data"]
    ExtractionSuccess -->|No| ManualReview["Record: Unable to Extract<br/>Route to operator<br/>for manual review"]

    RecordExtracted --> Complete
    ManualReview --> Complete
    Timeout --> Complete
    Complete --> Group
```

---

## IVR & Voicemail Handling

How the system handles automated phone systems and voicemail:

```mermaid
%%{init: {'fontSize': 18, 'fontFamily': 'arial'}}%%
flowchart TD
    Connected["Connected to hotel"] --> Detect{What is<br/>the connection?}

    Detect -->|IVR| IVRPath["IVR System Detected"]
    Detect -->|Voicemail| VMPath["Voicemail Detected"]
    Detect -->|Human| HumanPath["Human Detected"]

    IVRPath --> LoadIVR["Load hotel IVR profile<br/>from configuration"]
    LoadIVR --> SendNav["Send navigation input<br/>to reach billing/folio dept"]
    SendNav --> ListenForResponse["Listen for response<br/>or next menu prompt"]
    ListenForResponse --> MenuProgress{Progressed<br/>toward goal?}
    MenuProgress -->|No| NavFailed["Navigation failed<br/>Escalate to operator"]
    MenuProgress -->|Retry| SendNav
    MenuProgress -->|Success| HumanPath

    VMPath --> CheckVMPolicy["Check hotel policy<br/>for voicemail handling"]
    CheckVMPolicy --> LeaveMsg{Leave message<br/>or hang up?}
    LeaveMsg -->|Leave Message| RecMsg["Record voicemail message<br/>with folio request details<br/>+ email address + reference ID"]
    LeaveMsg -->|Hang Up| Disconnect["Disconnect without<br/>leaving message"]
    RecMsg --> VMDone["Mark: Voicemail-Message Left<br/>Schedule retry"]
    Disconnect --> VMDone2["Mark: Voicemail-No Message<br/>Schedule retry"]

    HumanPath --> Converse["Request folio details:<br/>Guest name, confirmation #<br/>Destination email"]
    Converse --> HumanResponse["Hotel responds"]
    HumanResponse --> RespType{What did<br/>they say?}

    RespType -->|Yes, will send| Agreement["Mark: Agreed to send folio"]
    RespType -->|Reservation<br/>not found| NotInSystem["Mark: Reservation not found"]
    RespType -->|Cannot<br/>provide| Decline["Mark: Refused"]
    RespType -->|Call back<br/>later| ExtractTime["Extract timing information<br/>from spoken response"]
    RespType -->|We'll send<br/>by X time| ExtractComm["Extract commitment details<br/>from spoken response"]

    ExtractTime --> ParseTime["Parse callback timeframe<br/>e.g., '2 hours', 'tomorrow', 'next week'"]
    ParseTime --> ScheduleCallback["Schedule follow-up call<br/>at requested time"]
    ScheduleCallback --> CBDone["Mark: Callback Scheduled<br/>Add to callback queue"]

    ExtractComm --> ParseComm["Parse commitment deadline<br/>e.g., 'EOD today', 'tomorrow morning'"]
    ParseComm --> ScheduleVerify["Schedule verification check<br/>at expected delivery time"]
    ScheduleVerify --> CommDone["Mark: Pending Verification<br/>Add to verification queue"]

    NavFailed --> Escalate["Escalate to operator<br/>for manual handling"]
    VMDone --> Exit["Done - Record complete"]
    VMDone2 --> Exit
    Agreement --> Exit
    NotInSystem --> Exit
    Decline --> Exit
    CBDone --> Exit
    CommDone --> Exit
    Escalate --> Exit
```

---

## Email-Based Folio Request Flow

How the system handles email-based folio requests and response extraction:

```mermaid
%%{init: {'fontSize': 18, 'fontFamily': 'arial'}}%%
flowchart TD
    Trigger["Email path needed<br/>or triggered"] --> Compose["Compose email:<br/>Guest name, Conf#<br/>Check-in/Check-out dates<br/>Folio request details"]

    Compose --> SendEmail["Send email<br/>From: Client email address<br/>To: Hotel email address"]
    SendEmail --> EnterMonitor["Enter email monitoring<br/>queue with timeout"]

    EnterMonitor --> Monitor["Monitor client email inbox<br/>for responses"]
    Monitor --> CheckResponse{Hotel<br/>response<br/>received?}

    CheckResponse -->|No| WaitMore["Continue monitoring"]
    WaitMore --> TimeoutCheck{Timeout<br/>exceeded?}
    TimeoutCheck -->|No| CheckResponse
    TimeoutCheck -->|Yes| NoResponse["Record: Email - No Response<br/>Escalate to operator"]

    CheckResponse -->|Yes| ReceiveEmail["Email received<br/>from hotel"]
    ReceiveEmail --> AnalyzeContent["Analyze email<br/>Check for attachments<br/>Review body content"]

    AnalyzeContent --> HasAttachment{Attachment<br/>present?}
    HasAttachment -->|Yes| ParseDoc["Parse attachment<br/>PDF/Image/Document<br/>OCR if needed"]
    HasAttachment -->|No| ParseBody["Parse email body<br/>Look for folio details"]

    ParseDoc --> ExtractFields["Extract fields:<br/>Folio number<br/>Guest name verification<br/>Room number<br/>Check-in/Check-out<br/>Charges/Amounts<br/>Payment terms"]

    ParseBody --> ExtractFields
    ExtractFields --> ValidationCheck{All required<br/>fields<br/>extracted?}

    ValidationCheck -->|Yes| Success["Record: Folio Received - Email<br/>Store extracted data<br/>Link to email"]
    ValidationCheck -->|No| PartialSuccess{Some fields<br/>extracted?}

    PartialSuccess -->|Yes| Partial["Record: Partial Data Extracted<br/>Store what was extracted<br/>Flag for review"]
    PartialSuccess -->|No| Failed["Record: Unable to Extract<br/>Escalate to operator<br/>Store raw email for manual review"]

    Success --> Complete["Mark record complete<br/>Update status visible to stakeholders"]
    Partial --> Complete
    Failed --> Complete
    NoResponse --> Complete
```

---

## Record Lifecycle

How a folio request record progresses through the system:

```mermaid
%%{init: {'fontSize': 18, 'fontFamily': 'arial'}}%%
graph LR
    R["Folio Request<br/>Record Created"]

    R -->|NEW| Sched["Scheduler<br/>picks up"]
    Sched -->|QUEUED| Batch["Batching<br/>Engine"]
    Batch -->|SCHEDULED| Call["Call<br/>Handler"]
    Call -->|IN_CALL| Process{Outcome}

    Process -->|Human agreed| S1["AGREED_TO_SEND"]
    Process -->|Not in system| S2["RESERVATION_NOT_FOUND"]
    Process -->|Refused| S3["REFUSED"]
    Process -->|Needs operator| S4["ESCALATED"]
    Process -->|Too long| S5["SENT_VIA_EMAIL"]
    Process -->|Voicemail+msg| S6["VOICEMAIL_MESSAGE_LEFT"]
    Process -->|Voicemail-no msg| S7["VOICEMAIL_NO_MESSAGE"]
    Process -->|IVR failed| S8["IVR_NAVIGATION_FAILED"]
    Process -->|Callback| S9["CALLBACK_SCHEDULED"]
    Process -->|Commitment| S10["PENDING_VERIFICATION"]

    S1 --> Final["FINAL STATUS<br/>Record complete<br/>Stored in system"]
    S2 --> Final
    S3 --> Final
    S4 --> Final
    S5 --> Final
    S8 --> Final

    S6 --> Retry["Scheduled for<br/>automatic retry<br/>at later time"]
    S7 --> Retry
    S9 --> Reschedule["Rescheduled record<br/>in callback queue<br/>Re-enters at<br/>target time"]
    S10 --> Verify["Verification scheduled<br/>Check if folio<br/>was received"]

    Retry -->|Retry time| Sched
    Reschedule -->|Callback time| Sched
    Verify -->|Verification time| Sched
    Final --> UI["Accessible via<br/>Status API & UI"]

    style R fill:#e3f2fd
    style Final fill:#c8e6c9
    style Retry fill:#fff3e0
    style Reschedule fill:#fff3e0
    style Verify fill:#fff3e0
    style UI fill:#fff9c4
```

---

## Component Interaction Sequence

Example of how components interact during a typical call:

```mermaid
%%{init: {'fontSize': 16, 'fontFamily': 'arial'}}%%
sequenceDiagram
    participant UI as User/System
    participant Sched as Scheduler
    participant Batch as Batching<br/>Engine
    participant Call as Call<br/>Handler
    participant Hotel as Hotel
    participant Operator as Operator
    participant Store as Storage
    participant Alert as Notification

    UI->>Sched: Records imported
    Sched->>Batch: Process batch
    Batch->>Batch: Group by phone
    Batch->>Call: Execute call to Hotel A
    Call->>Hotel: Initiate call
    Hotel-->>Call: Connected

    Note over Call,Hotel: Request Folio #1
    Call->>Hotel: Guest John, Conf 123, email
    Hotel-->>Call: OK, will send

    Note over Call,Hotel: Request Folio #2
    Call->>Hotel: Guest Jane, Conf 456, email
    Hotel-->>Call: Need supervisor
    Call->>Operator: Escalation needed
    Operator-->>Call: Handling it
    Call->>Hotel: Continuing...

    Note over Call,Hotel: Request Folio #3
    Call->>Hotel: Guest Bob, Conf 789, email
    Hotel-->>Call: Will try in 2 hours
    Call->>Call: Extract callback time

    Call->>Store: Save recording
    Store-->>Call: Stored
    Call->>Store: Update record statuses
    Call->>Alert: Send notifications
    Alert-->>UI: Status updated

    Operator->>UI: View call recording
    UI-->>Operator: Recording available
```

