'use strict';

const logger = require('./logger');

const STATE = Object.freeze({
  CLOSED: 'CLOSED',       // Normal operation — requests pass through
  OPEN: 'OPEN',           // Circuit tripped — requests rejected immediately
  HALF_OPEN: 'HALF_OPEN', // Testing recovery — limited requests allowed
});

/**
 * Circuit Breaker implementation.
 * Prevents cascading failures when an external dependency is unhealthy.
 *
 * State transitions:
 *   CLOSED  -> OPEN      (after failureThreshold consecutive failures)
 *   OPEN    -> HALF_OPEN (after recoveryTimeout ms has elapsed)
 *   HALF_OPEN -> CLOSED  (after successThreshold consecutive successes)
 *   HALF_OPEN -> OPEN    (on any failure)
 */
class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 30000;
    this.successThreshold = options.successThreshold || 2;

    this.state = STATE.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }

  async execute(fn) {
    if (this.state === STATE.OPEN) {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.recoveryTimeout) {
        this.state = STATE.HALF_OPEN;
        logger.info(`[CircuitBreaker:${this.name}] Transitioning to HALF_OPEN after ${elapsed}ms`);
      } else {
        const err = new Error(`Circuit breaker [${this.name}] is OPEN. Request rejected.`);
        err.code = 'CIRCUIT_OPEN';
        err.retryable = false;
        throw err;
      }
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure();
      throw error;
    }
  }

  _onSuccess() {
    if (this.state === STATE.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this._reset();
        logger.info(`[CircuitBreaker:${this.name}] CLOSED — recovered successfully`);
      }
    } else {
      this.failureCount = 0;
    }
  }

  _onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === STATE.HALF_OPEN || this.failureCount >= this.failureThreshold) {
      this.state = STATE.OPEN;
      this.successCount = 0;
      logger.warn(`[CircuitBreaker:${this.name}] OPENED after ${this.failureCount} failures`);
    }
  }

  _reset() {
    this.state = STATE.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
        ? new Date(this.lastFailureTime).toISOString()
        : null,
    };
  }
}

module.exports = CircuitBreaker;
