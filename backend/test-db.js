const mysql = require('mysql2/promise');
const { host, port, user, password } = require('./db.config.js');

console.log('当前 db.config.js 配置：');
console.log(`  host=${host}, port=${port}, user=${user}, password=***\n`);

const configs = [
  { label: `${host}:${port}`, host, port, user, password },
  { label: 'localhost:3306', host: 'localhost', port: 3306, user, password },
  { label: '127.0.0.1:3306', host: '127.0.0.1', port: 3306, user, password },
];

(async () => {
  for (const cfg of configs) {
    try {
      const conn = await mysql.createConnection({
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        connectTimeout: 3000,
      });
      await conn.query('SELECT 1');
      console.log(`✓ 连接成功: ${cfg.label}  用户=${cfg.user}`);
      await conn.end();
    } catch (err) {
      console.log(`✗ 连接失败: ${cfg.label}  →  ${err.message}`);
    }
  }
})();
