const { getIO } = require('../../core/socket/socket');
const redisService = require('../../core/redis/redis.service');
const { logger } = require('../../core/logger/logger');

function initNotificationService() {
  redisService.subscribeToNotifications('ride:notifications', (notification) => {
    const io = getIO();

    // Wave cancellation fan-out: tell stale offerees to close the offer now.
    // Late accepts stay rejected server-side; this event is UX/state sync.
    if (notification && notification.type === 'offer_cancelled') {
      const { cancelledDriverIds, correlationId, rideId, reason } = notification;
      if (!cancelledDriverIds || !Array.isArray(cancelledDriverIds)) {
        logger.warn({ type: 'notification', event: 'cancel_skipped', correlationId, reason: 'no cancelledDriverIds' });
        return;
      }
      for (const driverId of cancelledDriverIds) {
        io.to(`driver:${driverId}`).emit('ride:offer_cancelled', { rideId, reason: reason || 'driver_assigned' });
        logger.info({ type: 'socket', event: 'ride:offer_cancelled_emitted', correlationId, rideId, driverId });
      }
      return;
    }

    // correlationId is carried through the internal Redis payload for tracing;
    // strip it so the public Socket.IO event payload is unchanged.
    const { candidateDriverIds, correlationId, ...rideInfo } = notification;
    if (!candidateDriverIds || !Array.isArray(candidateDriverIds)) {
      logger.warn({ type: 'notification', event: 'emit_skipped', correlationId, reason: 'no candidateDriverIds' });
      return;
    }

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