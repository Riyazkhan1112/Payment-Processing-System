'use strict';

/**
 * In-memory idempotency key store.
 * Prevents duplicate payment creation for repeated requests with the same key.
 */
const idempotencyKeys = new Map();

const idempotencyStore = {
  set(key, response) {
    idempotencyKeys.set(key, {
      response,
      createdAt: new Date().toISOString(),
    });
  },

  get(key) {
    return idempotencyKeys.get(key) || null;
  },

  has(key) {
    return idempotencyKeys.has(key);
  },

  delete(key) {
    idempotencyKeys.delete(key);
  },

  clear() {
    idempotencyKeys.clear();
  },
};

module.exports = idempotencyStore;
