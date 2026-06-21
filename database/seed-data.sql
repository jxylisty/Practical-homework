-- ============================================================
-- 种子数据 - 舌诊体质辨识系统
-- ============================================================
USE doctor_system;

-- ==================== 用户账号 ====================
INSERT INTO user_accounts (username, password_hash, role) VALUES
('doctor', 'doctor', 'doctor'),
('zhangsan', '123456', 'patient'),
('lisi', '123456', 'patient'),
('wangwu', '123456', 'patient'),
('zhaoliu', '123456', 'patient'),
('qianqi', '123456', 'patient'),
('sunba', '123456', 'patient');

-- ==================== 患者档案 ====================
INSERT INTO patient_profiles (user_id, name, age, gender, height, weight, history_constitution, allergy_history, medical_history) VALUES
(2, '张三', 45, 'male', 172.0, 70.0, '平和质', '无', '无'),
(3, '李四', 38, 'female', 160.0, 55.0, '气虚质', '花粉过敏', '慢性胃炎'),
(4, '王五', 52, 'male', 175.0, 85.0, '痰湿质', '海鲜过敏', '高血压'),
(5, '赵六', 29, 'female', 165.0, 52.0, '阴虚质', '无', '失眠'),
(6, '钱七', 61, 'male', 170.0, 68.0, '血瘀质', '青霉素过敏', '冠心病'),
(7, '孙八', 33, 'female', 162.0, 58.0, '湿热质', '无', '湿疹');

-- ==================== 舌象采集记录 ====================
INSERT INTO tongue_image_records (user_id, front_image_url, image_quality, device_type, device_model) VALUES
(2, '/images/tongue/zhangsan_front.jpg', 8.5, '手机', 'iPhone 15'),
(3, '/images/tongue/lisi_front.jpg', 7.8, '手机', '华为P60'),
(4, '/images/tongue/wangwu_front.jpg', 9.0, '专业设备', '舌诊仪T1'),
(5, '/images/tongue/zhaoliu_front.jpg', 8.2, '手机', '小米14'),
(6, '/images/tongue/qianqi_front.jpg', 7.5, '手机', 'iPhone 15'),
(7, '/images/tongue/sunba_front.jpg', 8.8, '专业设备', '舌诊仪T1');

-- ==================== 体质辨识报告 ====================
INSERT INTO constitution_reports (record_id, user_id, constitution_type, confidence, tongue_features, explanation, ai_suggestion) VALUES
(1, 2, '平和质', 92.0, '{"tongue_color":"淡红","coating_color":"薄白","tongue_shape":"正常"}',
 '舌色淡红，苔薄白，舌形正常，为典型平和质表现。阴阳气血调和，整体健康状态良好。',
 '根据舌象分析，患者整体健康状态良好，建议保持现有生活方式，注意饮食均衡，适量运动。'),
(2, 3, '气虚质', 88.5, '{"tongue_color":"淡红","coating_color":"薄白","tongue_shape":"齿痕"}',
 '舌有齿痕，提示脾气虚弱。舌色淡红，苔薄白，为气虚体质特征。',
 '舌有齿痕，提示气虚，建议适当补气，避免过度劳累，可食用山药、红枣等。'),
(3, 4, '痰湿质', 85.0, '{"tongue_color":"淡黄","coating_color":"黄腻","tongue_shape":"胖大"}',
 '舌体胖大、苔黄腻，提示痰湿内蕴，湿热交阻。为典型痰湿体质表现。',
 '舌体胖大、苔黄腻，提示痰湿内蕴，建议清淡饮食，少食肥甘厚味。'),
(4, 5, '阴虚质', 90.2, '{"tongue_color":"红少苔","coating_color":"少苔","tongue_shape":"裂纹"}',
 '舌红少苔有裂纹，提示阴虚津亏。舌色偏红，苔少而干，为阴虚体质特征。',
 '舌红少苔有裂纹，提示阴虚，建议滋阴润燥，避免熬夜。'),
(5, 6, '血瘀质', 87.8, '{"tongue_color":"紫暗","coating_color":"薄白","tongue_shape":"瘀斑"}',
 '舌紫暗有瘀斑，提示血瘀内阻。舌色紫暗，可见瘀斑，为血瘀体质典型表现。',
 '舌紫暗有瘀斑，提示血瘀，建议活血化瘀，适当运动。'),
(6, 7, '湿热质', 91.0, '{"tongue_color":"红","coating_color":"黄腻","tongue_shape":"齿痕"}',
 '舌红苔黄腻，提示湿热内蕴。舌色偏红，苔黄而腻，为湿热体质特征。',
 '舌红苔黄腻，提示湿热，建议清热祛湿，饮食清淡。');

-- ==================== 报告反馈 ====================
INSERT INTO report_feedback (report_id, user_id, feedback_type, feedback_note) VALUES
(1, 2, 'useful', '分析很准确，和我的实际情况一致'),
(2, 3, 'useful', '建议很实用，正在尝试调理'),
(5, 6, 'useful', '说得对，确实需要注意活血');

-- ==================== 咨询单 ====================
INSERT INTO consultation_orders (report_id, patient_id, doctor_id, order_status, consult_reason, preferred_time, symptom_description) VALUES
(1, 2, 1, 'completed', '想了解日常保养方法', '工作日白天', '想知道平和质如何保持健康'),
(2, 3, 1, 'processing', '气虚质如何调理', '周末上午', '经常感到疲乏无力，想了解调理方案'),
(4, 5, NULL, 'pending', '阴虚质饮食建议', '随时', '经常口干舌燥，睡眠不好'),
(6, 7, NULL, 'pending', '湿热质如何改善', '工作日下午', '脸上容易长痘，舌苔厚腻');

-- ==================== 调理方案 ====================
INSERT INTO conditioning_plans (order_id, doctor_id, doctor_advice, ai_advice, diet_advice, exercise_advice, lifestyle_advice, contraindication_tips, followup_advice) VALUES
(1, 1,
 '患者为平和质，整体健康状态良好。建议继续保持当前生活方式，定期进行体质辨识。',
 '根据舌象和体质分析，患者阴阳气血调和，各方面指标正常。',
 '建议饮食多样化，荤素搭配，多食新鲜蔬果。春季宜养肝，可多食绿色蔬菜。',
 '保持适量运动，每周3-5次有氧运动，如快走、慢跑、太极拳等。',
 '保持规律作息，避免熬夜，保持良好心态。',
 '忌过度进补，避免滥用保健品。',
 '建议每半年进行一次体质辨识，动态监测健康状况。');
