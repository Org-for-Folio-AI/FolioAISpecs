Final Summary

We need a system that lets us create/import multiple “folio request” records and processes them on a schedule.

What the system does

For each record, the system uses the hotel phone number to place an automated call and request that the hotel send the folio/invoice matching the guest + reservation details in the record.

Record data

Required:

Unique ID

Guest first name

Guest last name

Reservation confirmation number

Check-in date

Check-out date

Hotel phone number (primary key for batching/calling)

Optional:

Hotel name and address

Also needed (practically required for completion):

Destination to send the folio (e.g., an email address / method to receive it)

Processing behavior

The system picks up all new records on a schedule.

It groups/batches records by hotel phone number.

For each hotel, it places a call and requests folios for each reservation one-by-one in the same call (when possible).

The system updates each record with a status/outcome, e.g.:

Could not connect

Voicemail

Asked to try later / callback requested (“call me in X hours/days”)

Reservation not found

Agreed to send invoice/folio

Refused / cannot share

Human follow-up required

Status + audit access

The system provides an API/UI to fetch the current status of any record.

The system stores and exposes call recordings per call, and each record in a batched call can reference the same recording.

Guardrails and controls (missing from your summary)

Harassment / retry rules (limits on retries, spacing between attempts, per-hotel caps)

Concurrency limits (how many calls can run at once)

Call controls: max call duration, max hold time, escalation when exceeded

Security / privacy considerations (at minimum: controlled handling of guest details)

Optional: real-time listening (to detect outcomes and update statuses faster)

Optional: IVR handling (navigating prompts, voicemail detection)

Good-to-have human escalation

A human can listen in and optionally join a live call.

Ability to invite a supervisor (or fall back to a polite “a human will contact you” handoff).
