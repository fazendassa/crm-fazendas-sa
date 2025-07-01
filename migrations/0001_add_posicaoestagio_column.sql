
-- Migration to add posicaoestagio column to pipeline_stages table
ALTER TABLE pipeline_stages ADD COLUMN posicaoestagio INTEGER DEFAULT 0;

-- Update existing records to have proper posicaoestagio values based on current position
UPDATE pipeline_stages SET posicaoestagio = position WHERE posicaoestagio = 0;

-- Create index for better performance
CREATE INDEX idx_pipeline_stages_posicaoestagio ON pipeline_stages(posicaoestagio);
