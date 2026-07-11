const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const app = require('./app');
const { initSocket } = require('./config/socket');
const { initNotificationService, shutdownNotificationService } = require('./services/notification.service');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

initSocket(server);
initNotificationService();

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access API at http://localhost:${PORT}/api/v1`);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
  process.exit(1);
});

process.on('SIGTERM', () => {
  shutdownNotificationService();
  server.close(() => process.exit(0));
});
