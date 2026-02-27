# Event Catalog

Complete catalog of all events in the Folio system. All events follow the standard event structure and are immutable once created.

## Standard Event Structure

```json
{
  "event_id": "uuid-v7",
  "event_type": "EventName",
  "aggregate_id": "folio_request_id",
  "aggregate_type": "FolioRequest",
  "sequence": 1,
  "timestamp": "ISO8601",
  "correlation_id": "batch_id or call_id",
  "causation_id": "parent_event_id",
  "data": {
    // Event-specific payload
  },
  "metadata": {
    "user_id": "system",
    "service": "component_name",
    "version": "1.0"
  }
}
```

---

## Record Lifecycle Events

### RecordCreated
When a new folio request record is created/imported.

```json
{
  "event_type": "RecordCreated",
  "aggregate_id": "req_001",
  "data": {
    "guest_first_name": "John",
    "guest_last_name": "Doe",
    "conf_number": "ABC123",
    "checkin_date": "2026-02-01",
    "checkout_date": "2026-02-05",
    "hotel_phone": "+1-501-555-1234",
    "destination_email": "john@example.com",
    "hotel_id": "hotel_001",
    "hotel_name": "Sample Hotel",
    "created_by": "api_import"
  }
}
```

### RecordQueued
When a record is picked up by scheduler and queued for processing.

```json
{
  "event_type": "RecordQueued",
  "aggregate_id": "req_001",
  "data": {
    "batch_id": "batch_20260206_hotel_15015551234_001",
    "queue_position": 1,
    "retry_attempt": 1
  },
  "correlation_id": "batch_20260206_hotel_15015551234_001"
}
```

---

## Batching Events

### BatchCreated
When records are grouped into a batch.

```json
{
  "event_type": "BatchCreated",
  "aggregate_id": "batch_20260206_hotel_15015551234_001",
  "aggregate_type": "Batch",
  "data": {
    "hotel_phone": "+1-501-555-1234",
    "record_ids": ["req_001", "req_002", "req_003"],
    "batch_size": 3,
    "created_by": "batching_engine"
  }
}
```

### BatchScheduled
When a batch is scheduled for calling.

```json
{
  "event_type": "BatchScheduled",
  "aggregate_id": "batch_20260206_hotel_15015551234_001",
  "data": {
    "estimated_duration_seconds": 120,
    "max_duration_seconds": 600,
    "needs_overflow": false,
    "call_folios_count": 3,
    "email_folios_count": 0,
    "scheduled_time": "2026-02-06T11:30:00Z"
  },
  "correlation_id": "batch_20260206_hotel_15015551234_001"
}
```

---

## Call Events

### CallInitiated
When a call to hotel is initiated.

```json
{
  "event_type": "CallInitiated",
  "aggregate_id": "call_20260206_150155512",
  "aggregate_type": "Call",
  "data": {
    "batch_id": "batch_20260206_hotel_15015551234_001",
    "hotel_phone": "+1-501-555-1234",
    "hotel_id": "hotel_001",
    "record_ids": ["req_001", "req_002", "req_003"],
    "initiated_by": "call_handler",
    "provider": "twilio"
  },
  "correlation_id": "batch_20260206_hotel_15015551234_001"
}
```

### CallConnected
When call is successfully connected.

```json
{
  "event_type": "CallConnected",
  "aggregate_id": "call_20260206_150155512",
  "data": {
    "connection_type": "unknown",
    "connected_at": "2026-02-06T11:30:05Z",
    "duration_until_connection_seconds": 5
  },
  "correlation_id": "call_20260206_150155512"
}
```

### IVRDetected
When IVR menu is detected.

```json
{
  "event_type": "IVRDetected",
  "aggregate_id": "call_20260206_150155512",
  "data": {
    "menu_options": [
      {"number": 1, "label": "Reservations"},
      {"number": 2, "label": "Billing"},
      {"number": 3, "label": "Front Desk"}
    ],
    "confidence": 0.95,
    "detected_by": "voice_llm"
  },
  "correlation_id": "call_20260206_150155512"
}
```

### IVRNavigationComplete
When IVR navigation finishes (successfully or not).

```json
{
  "event_type": "IVRNavigationComplete",
  "aggregate_id": "call_20260206_150155512",
  "data": {
    "success": true,
    "path_taken": ["2", "1"],
    "dtmf_commands": ["2", "1"],
    "duration_seconds": 12,
    "final_state": "human_detected"
  },
  "correlation_id": "call_20260206_150155512"
}
```

### IVRNavigationFailed
When IVR navigation fails.

```json
{
  "event_type": "IVRNavigationFailed",
  "aggregate_id": "call_20260206_150155512",
  "data": {
    "reason": "max_retries_exceeded",
    "attempts": 3,
    "error_message": "Menu not advancing after 3 attempts"
  },
  "correlation_id": "call_20260206_150155512"
}
```

### VoicemailDetected
When voicemail is detected.

```json
{
  "event_type": "VoicemailDetected",
  "aggregate_id": "call_20260206_150155512",
  "data": {
    "voicemail_type": "auto_attendant",
    "detected_phrases": ["Thank you for calling", "leave a message"],
    "confidence": 0.98,
    "leaves_option_to_record": true
  },
  "correlation_id": "call_20260206_150155512"
}
```

### HumanDetected
When a human agent is detected.

```json
{
  "event_type": "HumanDetected",
  "aggregate_id": "call_20260206_150155512",
  "data": {
    "detected_at": "2026-02-06T11:30:20Z",
    "confidence": 0.95
  },
  "correlation_id": "call_20260206_150155512"
}
```

### FolioRequested
When system requests folio from hotel.

```json
{
  "event_type": "FolioRequested",
  "aggregate_id": "req_001",
  "data": {
    "call_id": "call_20260206_150155512",
    "guest_name": "John Doe",
    "conf_number": "ABC123",
    "destination_email": "john@example.com",
    "request_text": "I'm requesting the folio for John Doe, confirmation ABC123...",
    "requested_at": "2026-02-06T11:30:25Z"
  },
  "correlation_id": "call_20260206_150155512"
}
```

### FolioAgreed
When hotel agrees to send folio.

```json
{
  "event_type": "FolioAgreed",
  "aggregate_id": "req_001",
  "data": {
    "call_id": "call_20260206_150155512",
    "agreement_text": "Yes, I can send that right away",
    "confidence": 0.95,
    "agreed_at": "2026-02-06T11:30:35Z"
  },
  "correlation_id": "call_20260206_150155512"
}
```

### FolioRefused
When hotel refuses to send folio.

```json
{
  "event_type": "FolioRefused",
  "aggregate_id": "req_001",
  "data": {
    "call_id": "call_20260206_150155512",
    "refusal_reason": "confidential_policy",
    "reason_text": "Our policy doesn't allow us to share billing information",
    "confidence": 0.90,
    "refused_at": "2026-02-06T11:30:40Z"
  },
  "correlation_id": "call_20260206_150155512"
}
```

### ReservationNotFound
When hotel cannot find reservation.

```json
{
  "event_type": "ReservationNotFound",
  "aggregate_id": "req_001",
  "data": {
    "call_id": "call_20260206_150155512",
    "not_found_text": "I don't have a record for that confirmation number",
    "confidence": 0.92,
    "at_time": "2026-02-06T11:30:45Z"
  },
  "correlation_id": "call_20260206_150155512"
}
```

### CallbackRequested
When hotel requests a callback.

```json
{
  "event_type": "CallbackRequested",
  "aggregate_id": "req_001",
  "data": {
    "call_id": "call_20260206_150155512",
    "request_text": "Please call back in about 2 hours",
    "extracted_timeframe": "2 hours",
    "target_time": "2026-02-06T13:30:00Z",
    "extraction_method": "speech_analysis",
    "confidence": 0.95,
    "requested_at": "2026-02-06T11:30:50Z"
  },
  "correlation_id": "call_20260206_150155512"
}
```

### CallEnded
When a call ends.

```json
{
  "event_type": "CallEnded",
  "aggregate_id": "call_20260206_150155512",
  "data": {
    "duration_seconds": 180,
    "end_time": "2026-02-06T11:33:00Z",
    "reason": "call_complete",
    "folios_requested": 3,
    "folios_agreed": 2,
    "folios_refused": 1
  },
  "correlation_id": "call_20260206_150155512"
}
```

---

## Email Events

### EmailComposed
When an email is composed.

```json
{
  "event_type": "EmailComposed",
  "aggregate_id": "email_20260206_req001",
  "aggregate_type": "Email",
  "data": {
    "record_id": "req_001",
    "from_address": "invoices@client.com",
    "to_address": "billing@hotel.com",
    "subject": "Folio Request for John Doe - Confirmation ABC123",
    "body_preview": "We are requesting the folio for...",
    "composed_at": "2026-02-06T11:45:00Z",
    "triggered_by": "call_overflow"
  }
}
```

### EmailSent
When an email is successfully sent.

```json
{
  "event_type": "EmailSent",
  "aggregate_id": "email_20260206_req001",
  "data": {
    "record_id": "req_001",
    "to_address": "billing@hotel.com",
    "message_id": "msg_abc123@smtp.client.com",
    "sent_at": "2026-02-06T11:45:15Z",
    "provider": "smtp"
  }
}
```

### EmailResponseReceived
When a response email is received.

```json
{
  "event_type": "EmailResponseReceived",
  "aggregate_id": "email_20260206_req001",
  "data": {
    "record_id": "req_001",
    "from_address": "billing@hotel.com",
    "message_id": "msg_xyz789@mail.hotel.com",
    "received_at": "2026-02-06T12:15:00Z",
    "body_preview": "Here is the folio for your guest...",
    "has_attachments": true,
    "attachment_count": 1
  }
}
```

### EmailResponseWithAttachment
When an email response contains attachments.

```json
{
  "event_type": "EmailResponseWithAttachment",
  "aggregate_id": "email_20260206_req001",
  "data": {
    "record_id": "req_001",
    "attachment_id": "att_xyz123",
    "filename": "folio_abc123.pdf",
    "mime_type": "application/pdf",
    "size_bytes": 125000,
    "received_at": "2026-02-06T12:15:00Z"
  }
}
```

---

## Data Extraction Events

### FolioExtracted
When folio data is successfully extracted.

```json
{
  "event_type": "FolioExtracted",
  "aggregate_id": "req_001",
  "data": {
    "email_id": "email_20260206_req001",
    "folio_number": "2501",
    "guest_name": "John Doe",
    "room_number": "305",
    "check_in_date": "2026-02-01",
    "check_out_date": "2026-02-05",
    "total_amount": 1760.00,
    "currency": "USD",
    "extraction_method": "email_text",
    "confidence": 0.95,
    "extracted_at": "2026-02-06T12:20:00Z"
  }
}
```

### ExtractionFailed
When data extraction fails.

```json
{
  "event_type": "ExtractionFailed",
  "aggregate_id": "req_001",
  "data": {
    "email_id": "email_20260206_req001",
    "reason": "no_recognizable_format",
    "error_message": "Could not match any known folio formats",
    "attempted_methods": ["template_matching", "nlp_analysis"],
    "failed_at": "2026-02-06T12:20:00Z"
  }
}
```

### PartialExtractionComplete
When partial data is extracted.

```json
{
  "event_type": "PartialExtractionComplete",
  "aggregate_id": "req_001",
  "data": {
    "email_id": "email_20260206_req001",
    "extracted_fields": ["folio_number", "total_amount"],
    "missing_fields": ["guest_name", "room_number"],
    "partial_data": {
      "folio_number": "2501",
      "total_amount": 1760.00
    },
    "completed_at": "2026-02-06T12:20:00Z"
  }
}
```

---

## Callback/Verification Events

### CallbackScheduled
When a callback is scheduled.

```json
{
  "event_type": "CallbackScheduled",
  "aggregate_id": "req_001",
  "data": {
    "callback_id": "cb_20260206_req001",
    "target_time": "2026-02-06T13:30:00Z",
    "reason": "hotel_requested",
    "original_request": "Please call back in about 2 hours",
    "scheduled_at": "2026-02-06T11:30:50Z"
  }
}
```

### CommitmentScheduled
When a commitment is scheduled for verification.

```json
{
  "event_type": "CommitmentScheduled",
  "aggregate_id": "req_001",
  "data": {
    "verification_id": "ver_20260206_req001",
    "commitment_text": "We'll send the folio by EOD tomorrow",
    "check_time": "2026-02-07T17:30:00Z",
    "verification_type": "email_check",
    "scheduled_at": "2026-02-06T11:40:00Z"
  }
}
```

---

## Status Events

### StatusUpdated
When a record's status changes.

```json
{
  "event_type": "StatusUpdated",
  "aggregate_id": "req_001",
  "data": {
    "old_status": "IN_CALL",
    "new_status": "AGREED_TO_SEND",
    "reason": "FolioAgreed event processed",
    "updated_at": "2026-02-06T11:35:00Z"
  }
}
```

### RecordCompleted
When a record reaches final status.

```json
{
  "event_type": "RecordCompleted",
  "aggregate_id": "req_001",
  "data": {
    "final_status": "FOLIO_RECEIVED",
    "folio_data": {
      "folio_number": "2501",
      "guest_name": "John Doe",
      "total_amount": 1760.00
    },
    "total_duration_seconds": 3600,
    "call_count": 1,
    "email_count": 1,
    "completed_at": "2026-02-06T12:30:00Z"
  }
}
```

---

## Error Events

### OperationFailed
When an operation fails.

```json
{
  "event_type": "OperationFailed",
  "aggregate_id": "req_001",
  "data": {
    "operation": "call_initiation",
    "error_code": "INVALID_PHONE_NUMBER",
    "error_message": "Phone number format invalid",
    "failed_at": "2026-02-06T11:30:00Z",
    "retry_attempt": 1
  }
}
```

### EscalationTriggered
When an escalation is triggered.

```json
{
  "event_type": "EscalationTriggered",
  "aggregate_id": "req_001",
  "data": {
    "reason": "irresolvable_callback_time",
    "description": "Could not parse callback time from response",
    "escalated_to": "operator",
    "escalation_priority": "normal",
    "escalated_at": "2026-02-06T11:35:00Z"
  }
}
```

---

## Event Versioning

All events include version information for schema evolution:

```json
{
  "metadata": {
    "event_version": "1.0",
    "schema_version": "2026-02-01"
  }
}
```

## Event Retention

- All events retained indefinitely in event store
- Snapshots created for performance (after 100+ events per aggregate)
- Archived events moved to cold storage after 1 year
- Event replays from archive may have slight performance impact

