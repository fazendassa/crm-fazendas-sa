
-- Migration to add posicaoestagio column to pipeline_stages table
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS posicaoestagio INTEGER DEFAULT 0;

-- Update existing records to have proper posicaoestagio values based on current position
-- Use ROW_NUMBER() to ensure sequential ordering starting from 1
UPDATE pipeline_stages 
SET posicaoestagio = subquery.row_num
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY pipeline_id ORDER BY position, id) as row_num
    FROM pipeline_stages
) AS subquery
WHERE pipeline_stages.id = subquery.id;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_posicaoestagio ON pipeline_stages(posicaoestagio);

-- Create function to automatically reorder positions when a stage is deleted
CREATE OR REPLACE FUNCTION reorder_pipeline_stages_on_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Reorder all stages in the same pipeline after deletion
    UPDATE pipeline_stages 
    SET posicaoestagio = subquery.new_position
    FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY posicaoestagio, id) as new_position
        FROM pipeline_stages 
        WHERE pipeline_id = OLD.pipeline_id
    ) AS subquery
    WHERE pipeline_stages.id = subquery.id 
    AND pipeline_stages.pipeline_id = OLD.pipeline_id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically reorder on delete
DROP TRIGGER IF EXISTS trigger_reorder_stages_on_delete ON pipeline_stages;
CREATE TRIGGER trigger_reorder_stages_on_delete
    AFTER DELETE ON pipeline_stages
    FOR EACH ROW
    EXECUTE FUNCTION reorder_pipeline_stages_on_delete();

-- Create function to ensure sequential positioning on insert/update
CREATE OR REPLACE FUNCTION ensure_sequential_positions()
RETURNS TRIGGER AS $$
BEGIN
    -- If inserting a new stage, set it to the next available position
    IF TG_OP = 'INSERT' THEN
        SELECT COALESCE(MAX(posicaoestagio), 0) + 1 INTO NEW.posicaoestagio
        FROM pipeline_stages 
        WHERE pipeline_id = NEW.pipeline_id;
    END IF;
    
    -- Ensure we don't exceed 12 stages per pipeline
    IF (SELECT COUNT(*) FROM pipeline_stages WHERE pipeline_id = NEW.pipeline_id) >= 12 AND TG_OP = 'INSERT' THEN
        RAISE EXCEPTION 'Pipeline cannot have more than 12 stages';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to ensure sequential positions
DROP TRIGGER IF EXISTS trigger_ensure_sequential_positions ON pipeline_stages;
CREATE TRIGGER trigger_ensure_sequential_positions
    BEFORE INSERT OR UPDATE ON pipeline_stages
    FOR EACH ROW
    EXECUTE FUNCTION ensure_sequential_positions();
