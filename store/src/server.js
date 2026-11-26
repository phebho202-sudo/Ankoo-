'use strict';
const http = require('node:http');
const config = require('./config');
const db = require('./db');
const { createApp } = require('./app');
const { errorPage } = require('./views/layout');

function build(database) {
  const app = createApp(database);
  app.errorPage = errorPage;
  require('./routes/shop')(app);
  require('./routes/content')(app);
  require('./routes/account')(app);
  require('./routes/checkout')(app);
  require('./routes/admin')(app);
  return app;
}

if (require.main === module) {
  const database = db.open(config.dbPath);
  const app = build(database);
  const server = http.createServer(app.handle);
  server.requestTimeout = 15 * 60 * 1000; // allow large video uploads on slow connections
  server.headersTimeout = 60 * 1000;
  server.listen(config.port, () => console.log(`ANKOO store running on http://localhost:${config.port}`));
  // Housekeeping: expired sessions and stale guest carts.
  setInterval(() => {
    const t = new Date().toISOString();
    database.prepare('DELETE FROM sessions WHERE expires_at < ?').run(t);
    database.prepare('DELETE FROM password_resets WHERE expires_at < ?').run(t);
    database.prepare('DELETE FROM carts WHERE user_id IS NULL AND updated_at < ?').run(new Date(Date.now() - 60 * 864e5).toISOString());
  }, 6 * 3600e3).unref();
  const stop = () => server.close(() => { database.close(); process.exit(0); });
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

module.exports = { build };
