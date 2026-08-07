-- Module 3 (FR-020): a manager nominates a delegate to approve on their
-- behalf for a date range. Overlap between two delegations for the same
-- manager is rejected at the service layer (delegationService.js), not here
-- — same interval-overlap approach already used for holidays — so there's
-- never ambiguity about who's the active delegate on a given day.
CREATE TABLE IF NOT EXISTS delegations (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    manager_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    delegate_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    start_date DATE NOT NULL,

    end_date DATE NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_delegations_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_delegations_not_self CHECK (manager_id != delegate_id)

);

CREATE INDEX IF NOT EXISTS idx_delegations_manager_id ON delegations (manager_id);
CREATE INDEX IF NOT EXISTS idx_delegations_delegate_id ON delegations (delegate_id);
