-- 005_add_staff_financial_fields.sql
-- Adds contracted_hours and base_pay_rate fields to the staff table to support financial calculations

-- Start transaction to ensure all changes are applied atomically
BEGIN;

-- Add contracted_hours and base_pay_rate columns to staff table
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS contracted_hours NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS base_pay_rate NUMERIC(8,2);

-- Add comments to document the new columns
COMMENT ON COLUMN staff.contracted_hours IS 'Number of hours per week a staff member is contracted for (e.g., 38.0, 20.5)';
COMMENT ON COLUMN staff.base_pay_rate IS 'Hourly pay rate in dollars for the staff member (e.g., 28.50, 42.75)';

-- Create indexes for faster financial queries
CREATE INDEX IF NOT EXISTS idx_staff_contracted_hours ON staff(contracted_hours);
CREATE INDEX IF NOT EXISTS idx_staff_pay_rate ON staff(base_pay_rate);
CREATE INDEX IF NOT EXISTS idx_staff_financial ON staff(base_pay_rate, contracted_hours);

-- Commit the transaction
COMMIT;
