-- Expands the notification catalog beyond the original leave-request/
-- profile-verification/salary-slip loops (032) with role-driven scenarios:
-- a voided slip, a manager reassignment (both sides), a salary structure
-- update, an account status change, delegation nomination, delegation
-- start/end (the first time-based, sweep-driven notifications — see
-- notificationSweepService.js — rather than event-driven), and an accepted
-- invite. `DELEGATION` is a new `entity_type`; the rest reuse the existing
-- `PROFILE`/`SALARY_SLIP` entity types (a notification "about a user's own
-- record" already meant `PROFILE`, regardless of which field changed).
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'LEAVE_REQUEST_SUBMITTED',
    'LEAVE_REQUEST_DECIDED',
    'LEAVE_REQUEST_WITHDRAWN_CANCELLED',
    'PROFILE_SUBMITTED',
    'PROFILE_VERIFIED',
    'PROFILE_SENT_BACK',
    'SALARY_SLIP_GENERATED',
    'SALARY_SLIP_VOIDED',
    'MANAGER_REASSIGNED',
    'TEAM_MEMBER_ASSIGNED',
    'SALARY_STRUCTURE_UPDATED',
    'ACCOUNT_STATUS_CHANGED',
    'DELEGATION_NOMINATED',
    'DELEGATION_STARTED',
    'DELEGATION_ENDED',
    'INVITE_ACCEPTED'
));

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_entity_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_entity_type_check
    CHECK (entity_type IN ('LEAVE_REQUEST', 'PROFILE', 'SALARY_SLIP', 'DELEGATION'));
