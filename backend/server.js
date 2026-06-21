const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

const uploadsDir = path.join(__dirname, '../frontend/uploads/tongue');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbConfig = { ...require('./db.config.js'), charset: 'utf8mb4' };
let pool;

function generateToken(userId, role) {
  return Buffer.from(`${userId}:${role}:${Date.now()}`).toString('base64');
}

async function initDb() {
  pool = mysql.createPool(dbConfig);
  try {
    await pool.query('SELECT 1');
    console.log('MySQL 连接成功');
  } catch (err) {
    console.error('MySQL 连接失败：', err.message);
    process.exit(1);
  }
}

// ==================== 登录 ====================
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.json({ success: false, message: '请输入账号和密码' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT * FROM user_accounts WHERE username = ? AND password_hash = ?',
      [username, password]
    );
    if (rows.length === 0) {
      return res.json({ success: false, message: '账号或密码错误' });
    }
    const user = rows[0];
    const token = generateToken(user.user_id, user.role);
    let displayName = username;
    if (user.role === 'patient') {
      const [profiles] = await pool.query('SELECT name FROM patient_profiles WHERE user_id = ?', [user.user_id]);
      if (profiles.length > 0) displayName = profiles[0].name;
    } else if (user.role === 'doctor') {
      displayName = '张医生';
    }
    res.json({
      success: true, message: '登录成功',
      user: { username, name: displayName, role: user.role, userId: user.user_id },
      token
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== 患者档案 ====================
app.post('/api/patient/profile', async (req, res) => {
  const { user_id, name, age, gender, height, weight, history_constitution, allergy_history, medical_history } = req.body;
  if (!user_id || !name || !age || !gender) {
    return res.json({ code: 400, message: '缺少必填参数：user_id、name、age、gender' });
  }
  try {
    const [existing] = await pool.query('SELECT profile_id FROM patient_profiles WHERE user_id = ?', [user_id]);
    if (existing.length > 0) {
      await pool.query(
        `UPDATE patient_profiles SET name=?, age=?, gender=?, height=?, weight=?, history_constitution=?, allergy_history=?, medical_history=? WHERE user_id=?`,
        [name, age, gender, height || null, weight || null, history_constitution || null, allergy_history || null, medical_history || null, user_id]
      );
      const [updated] = await pool.query('SELECT profile_id, updated_at FROM patient_profiles WHERE user_id = ?', [user_id]);
      return res.json({ code: 200, message: '档案更新成功', profile_id: String(updated[0].profile_id), updated_at: updated[0].updated_at });
    } else {
      const [result] = await pool.query(
        `INSERT INTO patient_profiles (user_id, name, age, gender, height, weight, history_constitution, allergy_history, medical_history) VALUES (?,?,?,?,?,?,?,?,?)`,
        [user_id, name, age, gender, height || null, weight || null, history_constitution || null, allergy_history || null, medical_history || null]
      );
      const [created] = await pool.query('SELECT profile_id, created_at FROM patient_profiles WHERE profile_id = ?', [result.insertId]);
      return res.json({ code: 200, message: '档案创建成功', profile_id: String(created[0].profile_id), updated_at: created[0].created_at });
    }
  } catch (err) {
    res.json({ code: 500, message: err.message });
  }
});

app.get('/api/patient/profile', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.json({ code: 400, message: '缺少 user_id' });
  try {
    const [rows] = await pool.query('SELECT * FROM patient_profiles WHERE user_id = ?', [user_id]);
    if (rows.length === 0) return res.json({ code: 404, message: '档案不存在' });
    const p = rows[0];
    res.json({ code: 200, message: '成功', data: p });
  } catch (err) {
    res.json({ code: 500, message: err.message });
  }
});

// ==================== 体质报告 ====================
app.get('/api/constitution/report/latest', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.json({ code: 400, message: '缺少 user_id' });
  try {
    const [rows] = await pool.query(
      `SELECT cr.*, tir.front_image_url, tir.shoot_time, tir.image_quality
       FROM constitution_reports cr
       JOIN tongue_image_records tir ON cr.record_id = tir.record_id
       WHERE cr.user_id = ?
       ORDER BY cr.generated_at DESC LIMIT 1`,
      [user_id]
    );
    if (rows.length === 0) return res.json({ code: 404, message: '暂无报告' });
    const r = rows[0];
    const features = typeof r.tongue_features === 'string' ? JSON.parse(r.tongue_features) : r.tongue_features;
    res.json({ code: 200, message: '成功', data: { ...r, tongue_features: features } });
  } catch (err) {
    res.json({ code: 500, message: err.message });
  }
});

// ==================== 报告反馈 ====================
app.post('/api/constitution/feedback', async (req, res) => {
  const { report_id, user_id, feedback_type, feedback_note } = req.body;
  if (!report_id || !user_id || !feedback_type) {
    return res.json({ code: 400, message: '缺少必填参数' });
  }
  if (!['useful', 'useless'].includes(feedback_type)) {
    return res.json({ code: 400, message: 'feedback_type 必须为 useful 或 useless' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO report_feedback (report_id, user_id, feedback_type, feedback_note) VALUES (?,?,?,?)',
      [report_id, user_id, feedback_type, feedback_note || null]
    );
    const [created] = await pool.query('SELECT feedback_id, created_at FROM report_feedback WHERE feedback_id = ?', [result.insertId]);
    res.json({ code: 200, message: '反馈提交成功', feedback_id: String(created[0].feedback_id), created_at: created[0].created_at });
  } catch (err) {
    res.json({ code: 500, message: err.message });
  }
});

// ==================== 咨询单 ====================
app.post('/api/consultation/orders', async (req, res) => {
  const { report_id, patient_id, consult_reason, preferred_time, symptom_description } = req.body;
  if (!report_id || !patient_id) {
    return res.json({ code: 400, message: '缺少必填参数：report_id、patient_id' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO consultation_orders (report_id, patient_id, consult_reason, preferred_time, symptom_description) VALUES (?,?,?,?,?)',
      [report_id, patient_id, consult_reason || null, preferred_time || null, symptom_description || null]
    );
    const [created] = await pool.query('SELECT order_id, order_status, created_at FROM consultation_orders WHERE order_id = ?', [result.insertId]);
    res.json({ code: 200, message: '咨询单创建成功', order_id: String(created[0].order_id), order_status: created[0].order_status, created_at: created[0].created_at });
  } catch (err) {
    res.json({ code: 500, message: err.message });
  }
});

app.get('/api/consultation/orders', async (req, res) => {
  const { patient_id, doctor_view } = req.query;
  try {
    let query, params;
    if (doctor_view) {
      query = `SELECT co.*, pp.name AS patient_name, pp.age AS patient_age, pp.gender AS patient_gender,
                      cr.constitution_type, cr.confidence, cr.tongue_features
               FROM consultation_orders co
               JOIN patient_profiles pp ON co.patient_id = pp.user_id
               JOIN constitution_reports cr ON co.report_id = cr.report_id
               ORDER BY co.created_at DESC`;
      params = [];
    } else if (patient_id) {
      query = `SELECT co.*, cr.constitution_type, cr.confidence
               FROM consultation_orders co
               JOIN constitution_reports cr ON co.report_id = cr.report_id
               WHERE co.patient_id = ?
               ORDER BY co.created_at DESC`;
      params = [patient_id];
    } else {
      return res.json({ code: 400, message: '缺少参数' });
    }
    const [rows] = await pool.query(query, params);
    res.json({ code: 200, message: '成功', data: rows });
  } catch (err) {
    res.json({ code: 500, message: err.message });
  }
});

app.put('/api/consultation/orders/:order_id', async (req, res) => {
  const { doctor_id, order_status } = req.body;
  try {
    const updates = [];
    const params = [];
    if (doctor_id) { updates.push('doctor_id = ?'); params.push(doctor_id); }
    if (order_status) { updates.push('order_status = ?'); params.push(order_status); }
    if (order_status === 'completed') { updates.push('closed_at = NOW()'); }
    if (updates.length === 0) return res.json({ code: 400, message: '无更新字段' });
    params.push(req.params.order_id);
    await pool.query(`UPDATE consultation_orders SET ${updates.join(', ')} WHERE order_id = ?`, params);
    res.json({ code: 200, message: '更新成功' });
  } catch (err) {
    res.json({ code: 500, message: err.message });
  }
});

// ==================== 调理方案 ====================
app.post('/api/consultation/plans', async (req, res) => {
  const { order_id, doctor_id, doctor_advice, diet_advice, exercise_advice, lifestyle_advice, contraindication_tips, followup_advice, ai_advice } = req.body;
  if (!order_id) return res.json({ code: 400, message: '缺少 order_id' });
  try {
    const [result] = await pool.query(
      `INSERT INTO conditioning_plans (order_id, doctor_id, doctor_advice, ai_advice, diet_advice, exercise_advice, lifestyle_advice, contraindication_tips, followup_advice) VALUES (?,?,?,?,?,?,?,?,?)`,
      [order_id, doctor_id || null, doctor_advice || null, ai_advice || null, diet_advice || null, exercise_advice || null, lifestyle_advice || null, contraindication_tips || null, followup_advice || null]
    );
    await pool.query("UPDATE consultation_orders SET order_status = 'completed', closed_at = NOW() WHERE order_id = ?", [order_id]);
    const [created] = await pool.query('SELECT plan_id, generated_at FROM conditioning_plans WHERE plan_id = ?', [result.insertId]);
    res.json({ code: 200, message: '调理方案提交成功', plan_id: String(created[0].plan_id), generated_at: created[0].generated_at });
  } catch (err) {
    res.json({ code: 500, message: err.message });
  }
});

app.get('/api/consultation/plans', async (req, res) => {
  const { order_id } = req.query;
  if (!order_id) return res.json({ code: 400, message: '缺少 order_id' });
  try {
    const [rows] = await pool.query('SELECT * FROM conditioning_plans WHERE order_id = ? ORDER BY plan_id DESC', [order_id]);
    res.json({ code: 200, message: '成功', data: rows });
  } catch (err) {
    res.json({ code: 500, message: err.message });
  }
});

// ==================== 舌象上传与AI分析 ====================
function mockAiAnalysis(age, gender) {
  const constitutions = [
    { type: '平和质', confidence: 92.0, tongue_color: '淡红', coating_color: '薄白', tongue_shape: '正常',
      explanation: '舌色淡红，苔薄白，舌形正常，为典型平和质表现。阴阳气血调和，整体健康状态良好。',
      suggestion: '根据舌象分析，患者整体健康状态良好，建议保持现有生活方式，注意饮食均衡，适量运动。' },
    { type: '气虚质', confidence: 88.5, tongue_color: '淡红', coating_color: '薄白', tongue_shape: '齿痕',
      explanation: '舌有齿痕，提示脾气虚弱。舌色淡红，苔薄白，为气虚体质特征。',
      suggestion: '舌有齿痕，提示气虚，建议适当补气，避免过度劳累，可食用山药、红枣等。' },
    { type: '痰湿质', confidence: 85.0, tongue_color: '淡黄', coating_color: '黄腻', tongue_shape: '胖大',
      explanation: '舌体胖大、苔黄腻，提示痰湿内蕴，湿热交阻。',
      suggestion: '舌体胖大、苔黄腻，提示痰湿内蕴，建议清淡饮食，少食肥甘厚味。' },
    { type: '阴虚质', confidence: 90.2, tongue_color: '红少苔', coating_color: '少苔', tongue_shape: '裂纹',
      explanation: '舌红少苔有裂纹，提示阴虚津亏。',
      suggestion: '舌红少苔有裂纹，提示阴虚，建议滋阴润燥，避免熬夜。' },
    { type: '血瘀质', confidence: 87.8, tongue_color: '紫暗', coating_color: '薄白', tongue_shape: '瘀斑',
      explanation: '舌紫暗有瘀斑，提示血瘀内阻。',
      suggestion: '舌紫暗有瘀斑，提示血瘀，建议活血化瘀，适当运动。' },
    { type: '湿热质', confidence: 91.0, tongue_color: '红', coating_color: '黄腻', tongue_shape: '齿痕',
      explanation: '舌红苔黄腻，提示湿热内蕴。',
      suggestion: '舌红苔黄腻，提示湿热，建议清热祛湿，饮食清淡。' },
  ];
  const idx = (age + (gender === 'male' ? 0 : 3)) % constitutions.length;
  return constitutions[idx];
}

app.post('/api/tongue/upload', async (req, res) => {
  const { user_id, image_data, image_type, device_type, device_model } = req.body;
  if (!user_id || !image_data) {
    return res.json({ code: 400, message: '缺少必填参数：user_id、image_data' });
  }
  try {
    const timestamp = Date.now();
    const ext = image_type === 'back' ? 'back' : 'front';
    const filename = `tongue_${user_id}_${ext}_${timestamp}.png`;
    const filePath = path.join(uploadsDir, filename);
    const base64Data = image_data.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
    const imageUrl = `/uploads/tongue/${filename}`;

    const [profiles] = await pool.query('SELECT age, gender FROM patient_profiles WHERE user_id = ?', [user_id]);
    let age = 30, gender = 'male';
    if (profiles.length > 0) { age = profiles[0].age || 30; gender = profiles[0].gender || 'male'; }

    const field = ext === 'front' ? 'front_image_url' : 'back_image_url';
    const [recordResult] = await pool.query(
      `INSERT INTO tongue_image_records (user_id, ${field}, image_quality, device_type, device_model) VALUES (?,?,?,?,?)`,
      [user_id, imageUrl, (8 + Math.random() * 2).toFixed(1), device_type || '手机', device_model || '未知']
    );
    const recordId = recordResult.insertId;
    let recordIdForReport = recordId;

    if (image_type === 'back') {
      const [recent] = await pool.query(
        "SELECT record_id FROM tongue_image_records WHERE user_id = ? AND front_image_url IS NOT NULL ORDER BY created_at DESC LIMIT 1",
        [user_id]
      );
      if (recent.length > 0) {
        await pool.query('UPDATE tongue_image_records SET back_image_url = ? WHERE record_id = ?', [imageUrl, recent[0].record_id]);
        recordIdForReport = recent[0].record_id;
      }
    }

    const result = mockAiAnalysis(age, gender);
    const tongueFeatures = JSON.stringify({ tongue_color: result.tongue_color, coating_color: result.coating_color, tongue_shape: result.tongue_shape });

    const [reportResult] = await pool.query(
      `INSERT INTO constitution_reports (record_id, user_id, ai_model_version, constitution_type, confidence, tongue_features, explanation, ai_suggestion)
       VALUES (?,?,?,?,?,?,?,?)`,
      [recordIdForReport, user_id, 'v2.0', result.type, result.confidence, tongueFeatures, result.explanation, result.suggestion]
    );

    const [report] = await pool.query('SELECT report_id, constitution_type, confidence, generated_at FROM constitution_reports WHERE report_id = ?', [reportResult.insertId]);

    res.json({ code: 200, message: '舌诊分析完成', data: {
      report_id: String(report[0].report_id), record_id: String(recordIdForReport),
      constitution_type: report[0].constitution_type, confidence: parseFloat(report[0].confidence),
      tongue_features: { tongue_color: result.tongue_color, coating_color: result.coating_color, tongue_shape: result.tongue_shape },
      explanation: result.explanation, ai_suggestion: result.suggestion,
      image_url: imageUrl, generated_at: report[0].generated_at
    }});
  } catch (err) {
    console.error('舌诊上传错误:', err);
    res.json({ code: 500, message: err.message });
  }
});

// ==================== 患者首页聚合数据 ====================
app.get('/api/patient/dashboard', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.json({ code: 400, message: '缺少 user_id' });
  try {
    const [profiles] = await pool.query('SELECT * FROM patient_profiles WHERE user_id = ?', [user_id]);
    const [reports] = await pool.query(
      `SELECT cr.*, tir.front_image_url, tir.shoot_time FROM constitution_reports cr
       JOIN tongue_image_records tir ON cr.record_id = tir.record_id
       WHERE cr.user_id = ? ORDER BY cr.generated_at DESC LIMIT 1`,
      [user_id]
    );
    const [orders] = await pool.query(
      "SELECT * FROM consultation_orders WHERE patient_id = ? AND order_status IN ('pending','processing') ORDER BY created_at DESC",
      [user_id]
    );
    res.json({ code: 200, message: '成功', data: { profile: profiles[0] || null, report: reports[0] || null, active_orders: orders } });
  } catch (err) {
    res.json({ code: 500, message: err.message });
  }
});

// ==================== 启动 ====================
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`服务器已启动: http://localhost:${PORT}`);
    console.log(`医生端: http://localhost:${PORT}/doctor.html`);
    console.log(`患者端: http://localhost:${PORT}/patient.html`);
  });
});
