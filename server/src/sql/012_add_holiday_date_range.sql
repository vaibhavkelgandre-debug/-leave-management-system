ALTER TABLE holidays RENAME COLUMN holiday_date TO start_date;

ALTER TABLE holidays DROP CONSTRAINT IF EXISTS holidays_holiday_date_key;

ALTER TABLE holidays ADD COLUMN end_date DATE;

UPDATE holidays SET end_date = start_date WHERE end_date IS NULL;

ALTER TABLE holidays
    ALTER COLUMN end_date SET NOT NULL,
    ADD CONSTRAINT holidays_end_date_not_before_start CHECK (end_date >= start_date);
