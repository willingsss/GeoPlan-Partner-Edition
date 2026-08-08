-- =========================================================================
-- 等时圈服务区字段迁移脚本
-- 适用：已有 t_charging_station 表，需新增等时圈字段
-- 执行：mysql -u root -p geoplan < migrations/add_isochrone_fields.sql
-- =========================================================================

-- 安全模式：仅在字段不存在时添加（MySQL 8.0+ 不支持 IF NOT EXISTS for ADD COLUMN，用存储过程兼容）
DROP PROCEDURE IF EXISTS add_isochrone_columns_if_not_exists;
DELIMITER $$
CREATE PROCEDURE add_isochrone_columns_if_not_exists()
BEGIN
    -- 快充等时圈几何
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 't_charging_station'
          AND column_name = 'isochrone_fast_geom'
    ) THEN
        ALTER TABLE t_charging_station
            ADD COLUMN isochrone_fast_geom JSON DEFAULT NULL
            COMMENT '快充等时圈多边形(驾车10分钟,WGS84 GeoJSON)' AFTER geom;
    END IF;

    -- 慢充等时圈几何
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 't_charging_station'
          AND column_name = 'isochrone_slow_geom'
    ) THEN
        ALTER TABLE t_charging_station
            ADD COLUMN isochrone_slow_geom JSON DEFAULT NULL
            COMMENT '慢充等时圈多边形(步行15分钟,WGS84 GeoJSON)' AFTER isochrone_fast_geom;
    END IF;

    -- 快充等时圈更新时间
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 't_charging_station'
          AND column_name = 'isochrone_fast_updated'
    ) THEN
        ALTER TABLE t_charging_station
            ADD COLUMN isochrone_fast_updated DATETIME DEFAULT NULL
            COMMENT '快充等时圈更新时间' AFTER isochrone_slow_geom;
    END IF;

    -- 慢充等时圈更新时间
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 't_charging_station'
          AND column_name = 'isochrone_slow_updated'
    ) THEN
        ALTER TABLE t_charging_station
            ADD COLUMN isochrone_slow_updated DATETIME DEFAULT NULL
            COMMENT '慢充等时圈更新时间' AFTER isochrone_fast_updated;
    END IF;

    -- 等时圈计算状态
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 't_charging_station'
          AND column_name = 'isochrone_status'
    ) THEN
        ALTER TABLE t_charging_station
            ADD COLUMN isochrone_status ENUM('pending','ok','partial','failed') NOT NULL DEFAULT 'pending'
            COMMENT '等时圈计算状态' AFTER isochrone_slow_updated;
    END IF;

    -- 等时圈状态索引
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 't_charging_station'
          AND index_name = 'idx_station_isochrone'
    ) THEN
        ALTER TABLE t_charging_station
            ADD INDEX idx_station_isochrone (isochrone_status);
    END IF;
END$$
DELIMITER ;

CALL add_isochrone_columns_if_not_exists();
DROP PROCEDURE IF EXISTS add_isochrone_columns_if_not_exists;

-- 验证字段已添加
SELECT
    COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 't_charging_station'
  AND COLUMN_NAME LIKE 'isochrone_%'
ORDER BY ORDINAL_POSITION;
