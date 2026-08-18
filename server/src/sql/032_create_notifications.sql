-- In-app notification system: one row per (recipient, event). Deliberately
-- single-recipient (never a broadcast row) so "mark this one read" and
-- "count my unread" stay a plain WHERE recipient_id = $1 — a multi-recipient
-- event (e.g. a leave request that both a manager and HR might care about)
-- is handled by inserting one row per recipient, not by widening this table.
CREATE TABLE IF NOT EXISTS notifications (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    recipient_id UUID NOT NULL REFERENCES users(id),

    -- Who/what caused this notification, e.g. the employee who submitted a
    -- request. Nullable for a hypothetical future system-generated
    -- notification with no human actor; every notification this app
    -- currently creates does set it.
    actor_id UUID REFERENCES users(id),

    -- One entry per notify* helper in notificationService.js — kept in sync
    -- with that file by hand, same as leave_requests.status's CHECK list is
    -- kept in sync with leaveRequestStateMachine.js.
    type VARCHAR(40) NOT NULL CHECK (type IN (
        'LEAVE_REQUEST_SUBMITTED',
        'LEAVE_REQUEST_DECIDED',
        'LEAVE_REQUEST_WITHDRAWN_CANCELLED',
        'PROFILE_SUBMITTED',
        'PROFILE_VERIFIED',
        'PROFILE_SENT_BACK',
        'SALARY_SLIP_GENERATED'
    )),

    -- What this notification is about, for the frontend to compute a
    -- deep-link route from (client/src/utils/notificationRouting.js) —
    -- deliberately not a stored route/URL, keeping UI routing concerns out
    -- of the database.
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('LEAVE_REQUEST', 'PROFILE', 'SALARY_SLIP')),
    entity_id UUID NOT NULL,

    -- A single precomputed human-readable line (e.g. "Priya Sharma submitted
    -- a Sick Leave request") rather than a template resolved client-side —
    -- keeps name/leave-type formatting in one place (notificationService.js)
    -- instead of duplicated on the frontend.
    message TEXT NOT NULL,

    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

-- Backs both "my unread count" and "my notification list, newest first" —
-- the only two access patterns this table needs to stay fast at NFR-7 scale.
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
    ON notifications (recipient_id, is_read, created_at DESC);
