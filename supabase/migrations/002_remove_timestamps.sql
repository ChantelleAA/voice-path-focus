-- Remove timestamp columns from tasks and subtasks tables
ALTER TABLE tasks DROP COLUMN created_at;
ALTER TABLE tasks DROP COLUMN updated_at;
ALTER TABLE subtasks DROP COLUMN created_at;

-- Drop the trigger and function for updated_at since we removed the column
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
DROP FUNCTION IF EXISTS update_updated_at_column();