-- 003_add_participant_filter_flags.sql
-- Adds boolean flag columns to the participants table for reliable filtering
-- while maintaining the existing text fields for detailed information.

-- =============================================================================
-- PARTICIPANT FILTER FLAGS
-- =============================================================================

-- Add boolean flag columns for filtering
ALTER TABLE participants
  ADD COLUMN has_wheelchair_access BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN has_dietary_requirements BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN has_medical_requirements BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN has_behavioral_support BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN has_visual_impairment BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN has_hearing_impairment BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN has_cognitive_support BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN has_communication_needs BOOLEAN NOT NULL DEFAULT false;

-- Add comments explaining the dual approach
COMMENT ON COLUMN participants.has_wheelchair_access IS 'Boolean flag for wheelchair access needs. Use with mobility_requirements text field for details.';
COMMENT ON COLUMN participants.has_dietary_requirements IS 'Boolean flag for any dietary requirements. Use with dietary_requirements text field for details.';
COMMENT ON COLUMN participants.has_medical_requirements IS 'Boolean flag for medical requirements. Use with medical_requirements text field for details.';
COMMENT ON COLUMN participants.has_behavioral_support IS 'Boolean flag for behavioral support needs. Corresponds to behavior_support_plan field.';
COMMENT ON COLUMN participants.has_visual_impairment IS 'Boolean flag for visual impairment support needs.';
COMMENT ON COLUMN participants.has_hearing_impairment IS 'Boolean flag for hearing impairment support needs.';
COMMENT ON COLUMN participants.has_cognitive_support IS 'Boolean flag for cognitive support needs.';
COMMENT ON COLUMN participants.has_communication_needs IS 'Boolean flag for communication support needs.';

-- Add index for faster filtering
CREATE INDEX idx_participant_support_flags ON participants (
  has_wheelchair_access,
  has_dietary_requirements,
  has_medical_requirements,
  has_behavioral_support,
  has_visual_impairment,
  has_hearing_impairment,
  has_cognitive_support,
  has_communication_needs
);

-- Update existing records based on text fields (if any data exists)
-- This ensures existing records get proper boolean flags based on their text content
UPDATE participants SET has_wheelchair_access = true WHERE mobility_requirements ILIKE '%wheelchair%';
UPDATE participants SET has_dietary_requirements = true WHERE dietary_requirements IS NOT NULL AND dietary_requirements != '';
UPDATE participants SET has_medical_requirements = true WHERE medical_requirements IS NOT NULL AND medical_requirements != '';
UPDATE participants SET has_behavioral_support = true WHERE behavior_support_plan = true;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE participants IS 'Participants with dual approach for support needs: boolean flags for filtering and text fields for details';
