
-- Migration to fix all zero positions in pipeline_stages table
-- This will update all stages with posicaoestagio = 0 to have proper sequential positions

-- Update all stages with posicaoestagio = 0 to have proper sequential ordering
UPDATE pipeline_stages 
SET posicaoestagio = subquery.row_num,
    position = subquery.row_num,
    updated_at = NOW()
FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY pipeline_id ORDER BY position, id) as row_num
    FROM pipeline_stages
    WHERE posicaoestagio = 0 OR posicaoestagio IS NULL
) AS subquery
WHERE pipeline_stages.id = subquery.id;

-- Update all stages to ensure sequential ordering within each pipeline (1, 2, 3, ...)
UPDATE pipeline_stages 
SET posicaoestagio = subquery.new_position,
    position = subquery.new_position,
    updated_at = NOW()
FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY pipeline_id ORDER BY COALESCE(posicaoestagio, position, 0), id) as new_position
    FROM pipeline_stages
) AS subquery
WHERE pipeline_stages.id = subquery.id;

-- Ensure no pipeline has more than 12 stages by keeping only the first 12 stages per pipeline
-- This is a safety measure in case there are more than 12 stages
WITH ranked_stages AS (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY pipeline_id ORDER BY posicaoestagio, position, id) as stage_rank
    FROM pipeline_stages
)
DELETE FROM pipeline_stages 
WHERE id IN (
    SELECT id FROM ranked_stages WHERE stage_rank > 12
);

-- Final reordering to ensure all remaining stages have sequential positions
UPDATE pipeline_stages 
SET posicaoestagio = subquery.final_position,
    position = subquery.final_position,
    updated_at = NOW()
FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY pipeline_id ORDER BY posicaoestagio, position, id) as final_position
    FROM pipeline_stages
) AS subquery
WHERE pipeline_stages.id = subquery.id;
