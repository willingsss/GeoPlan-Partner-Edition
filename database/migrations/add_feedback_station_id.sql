-- =========================================================================
-- t_feedback 表新增 station_id 列
-- 用于关联充电站（站点评价）与具体充电站 ID
-- 执行：mysql -u root -p geoplan < migrations/add_feedback_station_id.sql
-- =========================================================================

DROP PROCEDURE IF EXISTS add_feedback_station_id_if_not_exists;
DELIMITER $$
CREATE PROCEDURE add_feedback_station_id_if_not_exists()
BEGIN
    -- station_id 列：关联 t_charging_station.id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 't_feedback'
          AND column_name = 'station_id'
    ) THEN
        ALTER TABLE t_feedback
            ADD COLUMN station_id INT DEFAULT NULL
            COMMENT '关联充电站ID(评价类型), 需求类型为空'
            AFTER contact;
    END IF;

    -- station_id 索引
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 't_feedback'
          AND index_name = 'idx_feedback_station_id'
    ) THEN
        ALTER TABLE t_feedback
            ADD INDEX idx_feedback_station_id (station_id);
    END IF;
END$$
DELIMITER ;

CALL add_feedback_station_id_if_not_exists();
DROP PROCEDURE IF EXISTS add_feedback_station_id_if_not_exists;

-- 验证 station_id 列已添加
SELECT
    COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 't_feedback'
  AND COLUMN_NAME = 'station_id';
