-- A RENAME is the one kind of change that can't be made idempotent with an
-- IF NOT EXISTS clause: replaying it fails because the old column no longer
-- exists. Guarded on the column's presence instead, so the rename happens
-- exactly once and a replay skips it.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'holidays' AND column_name = 'holiday_date'
    ) THEN
        ALTER TABLE holidays RENAME COLUMN holiday_date TO start_date;
    END IF;
END $$;

ALTER TABLE holidays DROP CONSTRAINT IF EXISTS holidays_holiday_date_key;

ALTER TABLE holidays ADD COLUMN IF NOT EXISTS end_date DATE;

UPDATE holidays SET end_date = start_date WHERE end_date IS NULL;

ALTER TABLE holidays ALTER COLUMN end_date SET NOT NULL;

ALTER TABLE holidays DROP CONSTRAINT IF EXISTS holidays_end_date_not_before_start;
ALTER TABLE holidays ADD CONSTRAINT holidays_end_date_not_before_start CHECK (end_date >= start_date);
