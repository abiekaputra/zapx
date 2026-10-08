# ZapX user flows

## Flow 1: Owner prepares a local workspace

```text
Owner signs in
    ↓
Reviews seeded workspace
    ↓
Configures SMTP or webhook provider
    ↓
Runs connection test
    ↓
Creates a named API key
    ↓
Copies the key once
```

**Successful outcome:** the workspace has one usable delivery provider and one active API credential.  
**Failure outcomes:** invalid provider configuration is rejected; a failed connection test does not mark the provider ready; an API key secret is never shown again after creation.

## Flow 2: Developer submits a notification through the API

```text
Application authenticates with API key
    ↓
Submits channel, template, recipient, variables, and idempotency key
    ↓
ZapX validates authorization and payload
    ↓
ZapX stores notification and outbox event atomically
    ↓
API returns accepted notification identity and status URL
```

**Successful outcome:** the developer receives one traceable notification identity.  
**Failure outcomes:** malformed requests return field-level errors; revoked keys are rejected; conflicting reuse of an idempotency key is rejected; equivalent reuse returns the original logical notification.

## Flow 3: Operator sends from the web console

```text
Operator opens composer
    ↓
Selects channel, provider, and template
    ↓
Enters a synthetic recipient and template variables
    ↓
Reviews preview
    ↓
Submits notification
    ↓
Follows live status to a terminal result
```

**Successful outcome:** delivery reaches Mailpit or the local webhook receiver and the console displays the recorded result.  
**Failure outcomes:** incomplete variables prevent submission; unavailable dependencies produce an explicit recoverable error; the composer does not claim delivery before a worker result exists.

## Flow 4: Delivery succeeds

```text
Outbox relay claims unpublished event
    ↓
Queue accepts delivery job
    ↓
Worker applies rate limit
    ↓
Provider adapter sends message
    ↓
Attempt is recorded as successful
    ↓
Notification reaches delivered state
    ↓
Dashboard receives status update
```

**Successful outcome:** the detail page contains one coherent timeline from accepted request through provider response.

## Flow 5: Temporary failure recovers automatically

```text
Provider returns transient failure
    ↓
Attempt records sanitized error and retryability
    ↓
Worker schedules bounded backoff
    ↓
Dashboard shows retry scheduled
    ↓
Later attempt succeeds
    ↓
Notification reaches delivered state
```

**Successful outcome:** operators can see every attempt without taking manual action.

## Flow 6: Permanent failure reaches dead letter

```text
Provider rejects delivery or retry limit is reached
    ↓
Attempt records terminal failure
    ↓
Notification reaches dead-letter state
    ↓
Operator opens failure detail
    ↓
Owner corrects provider configuration if needed
    ↓
Owner or Operator requests replay
    ↓
ZapX creates an audited replay attempt
```

**Successful outcome:** failure remains visible and replay never erases the original attempt history.

## Flow 7: Viewer investigates without mutation access

```text
Viewer signs in
    ↓
Filters notifications by status, channel, provider, or time
    ↓
Opens notification detail
    ↓
Reviews attempts and trace identity
```

**Successful outcome:** the viewer can investigate but cannot create keys, change providers, send, retry, or replay.

## Flow 8: Owner revokes access

```text
Owner opens API keys
    ↓
Revokes selected key
    ↓
Audit event is recorded
    ↓
Further requests with that key are rejected
```

**Successful outcome:** revocation takes effect without deleting historical delivery ownership.
