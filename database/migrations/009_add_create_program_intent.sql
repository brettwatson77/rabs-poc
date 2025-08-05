-- database/migrations/009_add_create_program_intent.sql
--
-- Add CREATE_PROGRAM to tgl_intent_type enum
-- This allows the Master Schedule to create new programs via the intention system
-- as part of the Day 1 user journey workflow

-- Start transaction
BEGIN;

-- Add CREATE_PROGRAM to the tgl_intent_type enum
-- This makes the enum compatible with the frontend's CREATE_PROGRAM intent type
ALTER TYPE tgl_intent_type ADD VALUE 'CREATE_PROGRAM';

-- Add comment to explain the purpose
COMMENT ON TYPE tgl_intent_type IS 'Intent types for operator actions including CREATE_PROGRAM for new program creation';

-- Commit transaction
COMMIT;
