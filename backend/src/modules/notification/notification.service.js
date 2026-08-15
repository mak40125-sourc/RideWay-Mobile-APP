const { getIO } = require('../../core/socket/socket');
const redisService = require('../../core/redis/redis.service');
const { logger } = require('../../core/logger/logger');

function initNotificationService() {
  redisService.subscribeToNotifications('ride:notifications', (notification) => {
    // correlationId is carried through the internal Redis payload for tracing;
    // strip it so the public Socket.IO event payload is unchanged.
    const { candidateDriverIds, correlationId, ...rideInfo } = notification;
    if (!candidateDriverIds || !Array.isArray(candidateDriverIds)) {
      logger.warn({ type: 'notification', event: 'emit_skipped', correlationId, reason: 'no candidateDriverIds' });
      return;
    }

    const io = getIO();
    for (const driverId of candidateDriverIds) {
      const room = `driver:${driverId}`;
      const roomSockets = io.of('/').adapter.rooms.get(room);
      if (!roomSockets || roomSockets.size === 0) {
        logger.warn({
          type: 'socket',
          event: 'ride:offer_undeliverable',
          correlationId,
          rideId: rideInfo.rideId,
          driverId,
          room,
          reason: 'no_connected_socket',
        });
        continue;
      }
      io.to(room).emit('ride:request', rideInfo);
      logger.info({
        type: 'socket',
        event: 'ride:request_emitted',
        correlationId,
        rideId: rideInfo.rideId,
        driverId,
        room,
      });
    }
  });

  logger.info({ type: 'notification', event: 'subscribed', channel: 'ride:notifications' });
}

function shutdownNotificationService() {
  redisService.shutdown();
}

module.exports = { initNotificationService, shutdownNotificationService };