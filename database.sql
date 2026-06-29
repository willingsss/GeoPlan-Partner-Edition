-- =========================================================================
-- GeoPlan —— 基于WebGIS的新能源充电设施规划与决策支持平台
-- 数据库设计 (MySQL 8.0 + 空间扩展)
-- 适用区域: 江苏省徐州市 (经度 116.36°~118.67°, 纬度 33.72°~34.97°)
-- 坐标系: WGS 84 (EPSG:4326)，投影计算由应用层 Turf.js 完成 (EPSG:3857)
-- =========================================================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS geoplan
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE geoplan;

-- =========================================================================
-- 1. 充电站数据表 (t_charging_station)
-- 存储徐州市4大品牌充电站的空间与属性信息
-- =========================================================================
DROP TABLE IF EXISTS t_charging_station;
CREATE TABLE t_charging_station (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    station_code    VARCHAR(50)  NOT NULL UNIQUE COMMENT '充电站编码',
    name            VARCHAR(100) NOT NULL COMMENT '充电站名称',
    brand           VARCHAR(30)  NOT NULL COMMENT '运营品牌: 国家电网/特来电/星星充电/蔚来换电',
    district        VARCHAR(30)  NOT NULL COMMENT '所属行政区: 泉山区/云龙区/鼓楼区/铜山区',
    address         VARCHAR(200) NOT NULL COMMENT '详细地址',
    fast_chargers   INT          NOT NULL DEFAULT 0 COMMENT '快充桩数量',
    slow_chargers   INT          NOT NULL DEFAULT 0 COMMENT '慢充桩数量',
    total_power     DECIMAL(10,2) DEFAULT 0 COMMENT '总功率(kW)',
    status          VARCHAR(20)  NOT NULL DEFAULT '运营中' COMMENT '状态: 运营中/建设中/停运',
    lng             DECIMAL(10,6) NOT NULL COMMENT '经度 (WGS84)',
    lat             DECIMAL(10,6) NOT NULL COMMENT '纬度 (WGS84)',
    geom            POINT SRID 4326 NOT NULL COMMENT '空间点几何 (EPSG:4326)',
    create_time     DATETIME     DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    SPATIAL INDEX idx_station_geom (geom),
    INDEX idx_station_brand (brand),
    INDEX idx_station_district (district)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='充电站信息表';

-- =========================================================================
-- 2. 住宅小区面数据表 (t_community)
-- 存储徐州市住宅小区的面状空间信息与人口数据
-- =========================================================================
DROP TABLE IF EXISTS t_community;
CREATE TABLE t_community (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    community_code    VARCHAR(50)  NOT NULL UNIQUE COMMENT '小区编码',
    name              VARCHAR(100) NOT NULL COMMENT '小区名称',
    district          VARCHAR(30)  NOT NULL COMMENT '所属行政区',
    subdistrict       VARCHAR(50)  NOT NULL COMMENT '所属街道',
    population_total  INT          NOT NULL DEFAULT 0 COMMENT '常住总人口',
    household_count   INT          DEFAULT 0 COMMENT '户数',
    area_gis          DOUBLE       DEFAULT 0 COMMENT 'GIS计算面积(平方米)',
    geom              POLYGON SRID 4326 NOT NULL COMMENT '空间面几何 (EPSG:4326)',
    create_time       DATETIME     DEFAULT CURRENT_TIMESTAMP,
    update_time       DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    SPATIAL INDEX idx_community_geom (geom),
    INDEX idx_community_district (district)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='住宅小区面数据表';

-- =========================================================================
-- 3. 公众反馈数据表 (t_feedback)
-- 存储新能源车主提交的充电需求打点与站点评价
-- =========================================================================
DROP TABLE IF EXISTS t_feedback;
CREATE TABLE t_feedback (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    type          VARCHAR(20)  NOT NULL DEFAULT 'demand' COMMENT '反馈类型: demand-充电需求/evaluation-站点评价',
    description   TEXT         NOT NULL COMMENT '反馈描述',
    rating        TINYINT      DEFAULT NULL COMMENT '评分(1-5星), 仅评价类型',
    lng           DECIMAL(10,6) NOT NULL COMMENT '经度 (WGS84)',
    lat           DECIMAL(10,6) NOT NULL COMMENT '纬度 (WGS84)',
    geom          POINT SRID 4326 NOT NULL COMMENT '空间点几何',
    submitter     VARCHAR(50)  NOT NULL COMMENT '提交人',
    contact       VARCHAR(100) DEFAULT NULL COMMENT '联系方式',
    status        VARCHAR(20)  NOT NULL DEFAULT 'pending' COMMENT '审核状态: pending-待审核/approved-已通过/rejected-已驳回',
    create_time   DATETIME     DEFAULT CURRENT_TIMESTAMP,
    SPATIAL INDEX idx_feedback_geom (geom),
    INDEX idx_feedback_type (type),
    INDEX idx_feedback_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公众参与反馈表';

-- =========================================================================
-- 4. 选址方案数据表 (t_scheme)
-- 存储投资商保存的充电站选址方案及评估指标
-- =========================================================================
DROP TABLE IF EXISTS t_scheme;
CREATE TABLE t_scheme (
    id                    INT AUTO_INCREMENT PRIMARY KEY,
    name                  VARCHAR(100) NOT NULL COMMENT '方案名称',
    lng                   DECIMAL(10,6) NOT NULL COMMENT '选址经度',
    lat                   DECIMAL(10,6) NOT NULL COMMENT '选址纬度',
    geom                  POINT SRID 4326 NOT NULL COMMENT '选址中心点',
    radius                INT          NOT NULL DEFAULT 800 COMMENT '服务半径(米)',
    brand                 VARCHAR(30)  NOT NULL DEFAULT '国家电网' COMMENT '拟建品牌',
    covered_population    INT          DEFAULT 0 COMMENT '覆盖人口',
    covered_communities   INT          DEFAULT 0 COMMENT '覆盖社区数',
    blind_spot_reduction  DECIMAL(5,2) DEFAULT 0 COMMENT '盲区消除率(%)',
    competition_score     DECIMAL(5,2) DEFAULT 0 COMMENT '竞争避让度评分',
    social_benefit        DECIMAL(5,2) DEFAULT 0 COMMENT '社会效益综合评分',
    creator               VARCHAR(50)  NOT NULL COMMENT '创建人',
    create_time           DATETIME     DEFAULT CURRENT_TIMESTAMP,
    SPATIAL INDEX idx_scheme_geom (geom)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='选址方案表';

-- =========================================================================
-- 5. 系统用户表 (t_user)
-- 三种角色: 新能源车主 / 充电设施投资商 / 系统管理员
-- =========================================================================
DROP TABLE IF EXISTS t_user;
CREATE TABLE t_user (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE COMMENT '用户名',
    password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
    real_name     VARCHAR(50)  DEFAULT NULL COMMENT '真实姓名',
    role          VARCHAR(30)  NOT NULL DEFAULT '车主' COMMENT '角色: 车主/投资商/管理员',
    phone         VARCHAR(20)  DEFAULT NULL COMMENT '手机号',
    email         VARCHAR(100) DEFAULT NULL COMMENT '邮箱',
    status        VARCHAR(20)  NOT NULL DEFAULT '正常' COMMENT '状态: 正常/禁用',
    create_time   DATETIME     DEFAULT CURRENT_TIMESTAMP,
    last_login    DATETIME     DEFAULT NULL,
    INDEX idx_user_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统用户表';

-- =========================================================================
-- 6. 系统操作日志表 (t_log)
-- 记录用户操作行为，用于系统审计
-- =========================================================================
DROP TABLE IF EXISTS t_log;
CREATE TABLE t_log (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user        VARCHAR(50)  NOT NULL COMMENT '操作用户',
    action      VARCHAR(100) NOT NULL COMMENT '操作行为',
    detail      TEXT         DEFAULT NULL COMMENT '操作详情',
    ip_address  VARCHAR(50)  DEFAULT NULL COMMENT 'IP地址',
    create_time DATETIME     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_log_user (user),
    INDEX idx_log_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统操作日志表';

-- =========================================================================
-- 7. 区域统计视图 (v_region_stats)
-- 按行政区汇总充电站数量与品牌分布
-- =========================================================================
CREATE OR REPLACE VIEW v_region_stats AS
SELECT
    district,
    COUNT(*) AS station_count,
    SUM(fast_chargers) AS total_fast,
    SUM(slow_chargers) AS total_slow,
    SUM(CASE WHEN brand = '国家电网' THEN 1 ELSE 0 END) AS count_guowang,
    SUM(CASE WHEN brand = '特来电' THEN 1 ELSE 0 END) AS count_teld,
    SUM(CASE WHEN brand = '星星充电' THEN 1 ELSE 0 END) AS count_xingxing,
    SUM(CASE WHEN brand = '蔚来换电' THEN 1 ELSE 0 END) AS count_nio
FROM t_charging_station
WHERE status = '运营中'
GROUP BY district;

-- =========================================================================
-- 8. 空间分析 SQL 查询示例
-- =========================================================================

-- 8.1 查询指定充电站服务半径内覆盖的住宅小区 (ST_Intersects + ST_Buffer)
-- 注意: MySQL 8.0 的 ST_Buffer 在地理坐标系下精度有限，
--       实际项目中缓冲区计算由应用层 Turf.js (EPSG:3857) 完成。
/*
SELECT
    c.id AS community_id,
    c.name AS community_name,
    c.population_total,
    ST_Area(c.geom) AS community_area,
    ST_Area(ST_Intersection(c.geom, ST_Buffer(s.geom, 0.008))) AS covered_area
FROM t_community c, t_charging_station s
WHERE s.id = 1
  AND ST_Intersects(c.geom, ST_Buffer(s.geom, 0.008));
*/

-- 8.2 统计各行政区充电站密度 (每平方公里站点数)
/*
SELECT
    s.district,
    COUNT(*) AS station_count,
    ROUND(COUNT(*) / (SELECT SUM(area_gis) FROM t_community WHERE district = s.district) * 1000000, 2) AS density_per_sqkm
FROM t_charging_station s
WHERE s.status = '运营中'
GROUP BY s.district;
*/

-- 8.3 查询充电盲区社区 (周边 800 米内无运营中充电站)
-- 注意: 此查询在 MySQL 中需借助应用层预计算的缓冲区表，
--       或使用 ST_Distance_Sphere 进行球面距离过滤
/*
SELECT c.id, c.name, c.district, c.population_total
FROM t_community c
WHERE NOT EXISTS (
    SELECT 1 FROM t_charging_station s
    WHERE s.status = '运营中'
      AND ST_Distance_Sphere(s.geom, ST_Centroid(c.geom)) <= 800
);
*/

-- =========================================================================
-- 9. 初始化示例数据 (可选)
-- =========================================================================

-- 9.1 插入示例用户（与前端 DEMO_ACCOUNTS 保持一致）
INSERT INTO t_user (username, password_hash, role, status) VALUES
('admin',        'admin123', '管理员',   '正常'),
('车主_张先生', '123456',   '新能源车主', '正常'),
('投资商_王总', '123456',   '投资商',   '正常');

-- 9.2 插入示例充电站 (徐州市中心区域)
-- 注意: MySQL 9.x SRID 4326 坐标轴顺序为 (lat, lon)，为避免混淆，
--       此处 geom 字段使用 POINT(lat lon) 格式，lng/lat 字段单独存储标准 (经度, 纬度)
INSERT INTO t_charging_station (station_code, name, brand, district, address, fast_chargers, slow_chargers, total_power, status, lng, lat, geom) VALUES
('XZ-GW-001', '国家电网·彭城路充电站', '国家电网', '鼓楼区', '彭城路1号', 8, 4, 480.00, '运营中', 117.1923, 34.2651, ST_GeomFromText('POINT(34.2651 117.1923)', 4326)),
('XZ-GW-002', '国家电网·云龙公园充电站', '国家电网', '云龙区', '云龙公园南门', 6, 6, 360.00, '运营中', 117.1956, 34.2532, ST_GeomFromText('POINT(34.2532 117.1956)', 4326)),
('XZ-TL-001', '特来电·泉山广场充电站', '特来电', '泉山区', '泉山广场东侧', 10, 2, 600.00, '运营中', 117.1701, 34.2589, ST_GeomFromText('POINT(34.2589 117.1701)', 4326)),
('XZ-XX-001', '星星充电·铜山新区充电站', '星星充电', '铜山区', '铜山新区北京路', 4, 8, 240.00, '运营中', 117.1502, 34.2715, ST_GeomFromText('POINT(34.2715 117.1502)', 4326)),
('XZ-NIO-001', '蔚来换电·鼓楼换电站', '蔚来换电', '鼓楼区', '鼓楼区复兴路', 0, 0, 0.00, '运营中', 117.1889, 34.2701, ST_GeomFromText('POINT(34.2701 117.1889)', 4326));

-- 9.3 插入示例小区
INSERT INTO t_community (community_code, name, district, subdistrict, population_total, household_count, area_gis, geom) VALUES
('XZ-CM-001', '风华园小区', '泉山区', '泰山街道', 12000, 4000, 180000.00, ST_GeomFromText('POLYGON((34.2550 117.1650, 34.2550 117.1720, 34.2620 117.1720, 34.2620 117.1650, 34.2550 117.1650))', 4326)),
('XZ-CM-002', '云龙花园', '云龙区', '彭城街道', 8500, 2800, 120000.00, ST_GeomFromText('POLYGON((34.2480 117.1900, 34.2480 117.1980, 34.2550 117.1980, 34.2550 117.1900, 34.2480 117.1900))', 4326)),
('XZ-CM-003', '鼓楼新村', '鼓楼区', '黄楼街道', 15000, 5000, 220000.00, ST_GeomFromText('POLYGON((34.2680 117.1850, 34.2680 117.1930, 34.2750 117.1930, 34.2750 117.1850, 34.2680 117.1850))', 4326));

-- 9.4 插入示例反馈
INSERT INTO t_feedback (type, description, rating, lng, lat, geom, submitter, status) VALUES
('demand', '小区周边充电桩太少，排队时间长，建议增设快充桩', NULL, 117.1680, 34.2600, ST_GeomFromText('POINT(34.2600 117.1680)', 4326), '车主_张先生', 'pending'),
('evaluation', '国家电网·彭城路充电站服务好，充电速度快', 5, 117.1923, 34.2651, ST_GeomFromText('POINT(34.2651 117.1923)', 4326), '投资商_王总', 'approved');

-- 9.5 插入示例系统日志
INSERT INTO t_log (user, action, detail, ip_address) VALUES
('admin', '系统登录', '管理员登录系统', '127.0.0.1'),
('investor', '方案保存', '保存选址方案: 彭城路快充站', '127.0.0.1'),
('driver', '反馈提交', '提交充电需求反馈', '127.0.0.1');
