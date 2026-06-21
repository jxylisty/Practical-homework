const fs = require('fs');
const path = require('path');

const backendDir = path.join(__dirname, '../backend');
const mysql = require(path.join(backendDir, 'node_modules/mysql2/promise'));
const dbConfig = require(path.join(backendDir, 'db.config.js'));

async function migrate() {
  const conn = await mysql.createConnection({ ...dbConfig, multipleStatements: true });
  try {
    // 执行新 schema
    const schemaSql = fs.readFileSync(path.join(__dirname, 'new_schema.sql'), 'utf8');
    await conn.query(schemaSql);
    console.log('✅ 新表结构创建成功！');

    // 执行种子数据
    const seedSql = fs.readFileSync(path.join(__dirname, 'seed-data.sql'), 'utf8');
    await conn.query(seedSql);
    console.log('✅ 种子数据插入成功！');

    console.log('🎉 数据库迁移完成！所有表已创建并填充示例数据。');
  } catch (err) {
    console.error('❌ 迁移失败：', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

migrate();
