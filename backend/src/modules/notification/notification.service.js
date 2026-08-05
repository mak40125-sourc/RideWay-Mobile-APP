const { getIO } = require('../../core/socket/socket');
const redisService = require('../../core/redis/redis.service');

function initNotificationService() {
  redisService.subscribeToNotifications('ride:notifications', (notification) => {
    const { candidateDriverIds, ...rideInfo } = notification;
    if (!candidateDriverIds || !Array.isArray(candidateDriverIds)) return;

    const io = getIO();
    for (const driverId of candidateDriverIds) {
      io.to(`driver:${driverId}`).emit('ride:request', rideInfo);
    }
  });

  console.log('Notification service subscribed to ride:notifications');
}

function shutdownNotificationService() {
  redisService.shutdown();
}

module.exports = { initNotificationService, shutdownNotificationService };
