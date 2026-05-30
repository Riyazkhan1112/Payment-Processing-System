'use strict';

/**
 * In-process concurrency lock.
 * Prevents the same payment from being processed in parallel
 * (e.g., duplicate webhook + retry arriving simultaneously).
 */
class ConcurrencyLock {
  constructor() {
    this.locks = new Map();
  }

  /**
   * Acquires a lock for the given key. Waits (polls) until the lock is free.
   * @param {string} key - Unique lock identifier (e.g., "payment:<id>")
   * @param {number} timeout - Max wait time in ms before throwing
   */
  async acquire(key, timeout = 30000) {
    const start = Date.now();

    while (this.locks.has(key)) {
      if (Date.now() - start > timeout) {
        const err = new Error(`Lock acquisition timeout for key: ${key}`);
        err.code = 'LOCK_TIMEOUT';
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    this.locks.set(key, Date.now());
  }

  /**
   * Releases the lock for the given key.
   */
  release(key) {
    return this.locks.delete(key);
  }

  isLocked(key) {
    return this.locks.has(key);
  }

  /**
   * Executes a function exclusively under a named lock.
   * Always releases the lock after execution (success or failure).
   */
  async withLock(key, fn, timeout = 30000) {
    await this.acquire(key, timeout);
    try {
      return await fn();
    } finally {
      this.release(key);
    }
  }
}

module.exports = new ConcurrencyLock();
