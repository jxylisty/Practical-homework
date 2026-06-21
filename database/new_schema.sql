-- ============================================================
-- 舌诊体质辨识系统 - 完整数据库设计 v2.0
-- 在 Navicat 中执行此脚本，或运行 npm run migrate
-- ============================================================

USE doctor_system;

-- ==================== 清理旧表（按外键依赖顺序） ====================
DROP TABLE IF EXISTS suggestion_view_logs;
DROP TABLE IF EXISTS conditioning_plans;
DROP TABLE IF EXISTS consultation_orders;
DROP TABLE IF EXISTS report_feedback;
DROP TABLE IF EXISTS constitution_reports;
DROP TABLE IF EXISTS tongue_image_records;
DROP TABLE IF EXISTS patient_profiles;
DROP TABLE IF EXISTS user_accounts;
DROP TABLE IF EXISTS history_records;
DROP TABLE IF EXISTS patients;

-- ==================== 1. 用户账号表 ====================
CREATE TABLE user_accounts (
  user_id INT AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID',
  username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
  phone_hash VARCHAR(64) COMMENT '手机号哈希(SHA256)',
  phone_encrypted VARCHAR(256) COMMENT '手机号加密(AES)',
  password_hash VARCHAR(256) NOT NULL COMMENT '密码哈希',
  failed_login_attempts INT DEFAULT 0 COMMENT '连续登录失败次数',
  locked_until TIMESTAMP NULL COMMENT '账号锁定到期时间',
  login_status TINYINT DEFAULT 0 COMMENT '登录状态：0离线 1在线',
  role ENUM('patient', 'doctor', 'admin') NOT NULL DEFAULT 'patient' COMMENT '角色',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) COMMENT='用户账号表';

-- ==================== 2. 患者档案表 ====================
CREATE TABLE patient_profiles (
  profile_id INT AUTO_INCREMENT PRIMARY KEY COMMENT '档案ID',
  user_id INT NOT NULL COMMENT '用户ID',
  name VARCHAR(100) NOT NULL COMMENT '患者姓名',
  age INT NOT NULL COMMENT '年龄',
  gender ENUM('male', 'female') NOT NULL COMMENT '性别',
  height DECIMAL(5,1) DEFAULT NULL COMMENT '身高(cm)',
  weight DECIMAL(5,1) DEFAULT NULL COMMENT '体重(kg)',
  history_constitution VARCHAR(255) DEFAULT NULL COMMENT '既往体质',
  allergy_history TEXT COMMENT '过敏史',
  medical_history TEXT COMMENT '既往病史',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE
) COMMENT='患者档案表';

-- ==================== 3. 舌象采集记录表 ====================
CREATE TABLE tongue_image_records (
  record_id INT AUTO_INCREMENT PRIMARY KEY COMMENT '采集记录ID',
  user_id INT NOT NULL COMMENT '用户ID',
  front_image_url VARCHAR(500) DEFAULT NULL COMMENT '正面图URL',
  back_image_url VARCHAR(500) DEFAULT NULL COMMENT '反面图URL',
  shoot_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '拍摄时间',
  image_quality DECIMAL(3,1) DEFAULT 0.0 COMMENT '图像质量分(0-10)',
  device_type VARCHAR(50) DEFAULT NULL COMMENT '设备类型',
  device_model VARCHAR(100) DEFAULT NULL COMMENT '设备型号',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE
) COMMENT='舌象采集记录表';

-- ==================== 4. 体质辨识报告表 ====================
CREATE TABLE constitution_reports (
  report_id INT AUTO_INCREMENT PRIMARY KEY COMMENT '报告ID',
  record_id INT NOT NULL COMMENT '舌象采集记录ID',
  user_id INT NOT NULL COMMENT '用户ID',
  ai_model_version VARCHAR(50) DEFAULT 'v1.0' COMMENT 'AI模型版本',
  constitution_type VARCHAR(50) NOT NULL COMMENT '主体质类型',
  confidence DECIMAL(5,1) NOT NULL COMMENT '主体质置信度',
  concurrent_constitution JSON DEFAULT NULL COMMENT '兼夹体质JSON',
  tongue_features JSON DEFAULT NULL COMMENT '舌象特征JSON',
  explanation TEXT COMMENT '解释信息',
  ai_suggestion TEXT COMMENT 'AI建议',
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '生成时间',
  FOREIGN KEY (record_id) REFERENCES tongue_image_records(record_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE
) COMMENT='体质辨识报告表';

-- ==================== 5. 报告反馈表 ====================
CREATE TABLE report_feedback (
  feedback_id INT AUTO_INCREMENT PRIMARY KEY COMMENT '反馈ID',
  report_id INT NOT NULL COMMENT '报告ID',
  user_id INT NOT NULL COMMENT '用户ID',
  feedback_type ENUM('useful', 'useless') NOT NULL COMMENT '反馈类型',
  feedback_note VARCHAR(500) DEFAULT NULL COMMENT '反馈备注',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (report_id) REFERENCES constitution_reports(report_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE
) COMMENT='报告反馈表';

-- ==================== 6. 咨询单表 ====================
CREATE TABLE consultation_orders (
  order_id INT AUTO_INCREMENT PRIMARY KEY COMMENT '咨询单ID',
  report_id INT NOT NULL COMMENT '报告ID',
  patient_id INT NOT NULL COMMENT '患者用户ID',
  doctor_id INT DEFAULT NULL COMMENT '医生用户ID',
  order_status ENUM('pending', 'processing', 'completed', 'cancelled') NOT NULL DEFAULT 'pending' COMMENT '咨询状态',
  consult_reason VARCHAR(500) DEFAULT NULL COMMENT '咨询原因',
  preferred_time VARCHAR(100) DEFAULT NULL COMMENT '偏好时间',
  symptom_description TEXT COMMENT '症状描述',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  closed_at TIMESTAMP NULL DEFAULT NULL COMMENT '关闭时间',
  FOREIGN KEY (report_id) REFERENCES constitution_reports(report_id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL
) COMMENT='咨询单表';

-- ==================== 7. 调理方案表 ====================
CREATE TABLE conditioning_plans (
  plan_id INT AUTO_INCREMENT PRIMARY KEY COMMENT '方案ID',
  order_id INT NOT NULL COMMENT '咨询单ID',
  doctor_id INT DEFAULT NULL COMMENT '医生用户ID',
  doctor_advice TEXT COMMENT '医生建议',
  ai_advice TEXT COMMENT 'AI辅助建议',
  diet_advice TEXT COMMENT '饮食建议',
  exercise_advice TEXT COMMENT '运动建议',
  lifestyle_advice TEXT COMMENT '生活习惯建议',
  contraindication_tips TEXT COMMENT '禁忌提示',
  followup_advice TEXT COMMENT '随访建议',
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '生成时间',
  FOREIGN KEY (order_id) REFERENCES consultation_orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL
) COMMENT='调理方案表';

-- ==================== 8. 建议查看日志表 ====================
CREATE TABLE suggestion_view_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY COMMENT '日志ID',
  plan_id INT NOT NULL COMMENT '调理方案ID',
  patient_id INT NOT NULL COMMENT '患者用户ID',
  view_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '查看时间',
  view_terminal VARCHAR(50) DEFAULT NULL COMMENT '查看终端',
  ip_address VARCHAR(45) DEFAULT NULL COMMENT 'IP地址',
  FOREIGN KEY (plan_id) REFERENCES conditioning_plans(plan_id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE
) COMMENT='建议查看日志表';
