
-- Migration to ensure fixed stages are in correct positions
-- Prospecção should always be position 0, Fechamento should always be last

-- First, update Prospecção to position 0 in all pipelines
UPDATE pipeline_stages 
SET position = 0, 
    posicaoestagio = 0,
    updated_at = NOW()
WHERE title = 'Prospecção';

-- Then, for each pipeline, set Fechamento to be the last position
UPDATE pipeline_stages 
SET position = subquery.max_pos + 1,
    posicaoestagio = subquery.max_pos + 1,
    updated_at = NOW()
FROM (
    SELECT pipeline_id, 
           COALESCE(MAX(CASE WHEN title != 'Fechamento' THEN position END), 0) as max_pos
    FROM pipeline_stages
    GROUP BY pipeline_id
) AS subquery
WHERE pipeline_stages.pipeline_id = subquery.pipeline_id 
AND pipeline_stages.title = 'Fechamento';

-- Finally, reorder all other stages to fill gaps between Prospecção and Fechamento
UPDATE pipeline_stages 
SET position = subquery.new_position,
    posicaoestagio = subquery.new_position,
    updated_at = NOW()
FROM (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY pipeline_id 
               ORDER BY 
                   CASE WHEN title = 'Prospecção' THEN 0 
                        WHEN title = 'Fechamento' THEN 999 
                        ELSE position 
                   END,
                   id
           ) - 1 as new_position
    FROM pipeline_stages
) AS subquery
WHERE pipeline_stages.id = subquery.id;
