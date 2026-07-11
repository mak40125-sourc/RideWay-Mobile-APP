const Redis = require('ioredis');
const { getIO } = require('../config/socket');

let subscriber = null;

function initNotificationService() {
  subscriber = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    lazyConnect: true,
    retryStrategy: (times) => {
      if (times > 3) {
        console.log('Notification subscriber: Redis unavailable');
        return null;
      }
      return Math.min(times * 200, 2000);
    },
  });

  subscriber.on('connect', () => {
    console.log('Notification service connected to Redis');
    subscriber.subscribe('ride:notifications', (err) => {
      if (err) {
        console.error('Failed to subscribe to ride:notifications:', err.message);
      }
    });
  });

  subscriber.on('message', (channel, message) => {
    if (channel !== 'ride:notifications') return;

    try {
      const notification = JSON.parse(message);
      const { candidateDriverIds, ...rideInfo } = notification;

      const io = getIO();
      for (const driverId of candidateDriverIds) {
        io.to(`driver:${driverId}`).emit('ride:request', rideInfo);
      }
    } catch (err) {
      console.error('Failed to process ride notification:', err.message);
    }
  });

  subscriber.on('error', (err) => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Notification service error:', err.message);
    }
  });
}

function shutdownNotificationService() {
  if (subscriber) {
    subscriber.unsubscribe();
    subscriber.quit();
  }
}

module.exports = { initNotificationService, shutdownNotificationService };
