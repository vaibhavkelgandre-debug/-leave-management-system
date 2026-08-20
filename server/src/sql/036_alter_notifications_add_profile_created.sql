-- Adds PROFILE_CREATED: notifies a brand-new employee themself, right when
-- they accept their invite and their account first becomes ACTIVE, that
-- they still need to fill in their profile and upload their mandatory
-- documents before HR can verify them. Reuses the existing PROFILE
-- entity_type -- same "about a user's own record" bucket as every other
-- profile-lifecycle notification -- so no entity_type change is needed.
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
    'INVITE_ACCEPTED',
    'PROFILE_CREATED'
));
