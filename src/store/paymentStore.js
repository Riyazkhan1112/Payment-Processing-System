'use strict';

/**
 * In-memory payment store (replaces database for static/demo mode).
 * All payments are stored in a Map keyed by payment ID.
 */
const payments = new Map();

const paymentStore = {
  create(payment) {
    payments.set(payment.id, { ...payment });
    return payments.get(payment.id);
  },

  findById(id) {
    return payments.get(id) || null;
  },

  update(id, updates) {
    const existing = payments.get(id);
    if (!existing) {
      return null;
    }
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    payments.set(id, updated);
    return updated;
  },

  findAll() {
    return Array.from(payments.values());
  },

  findByIdempotencyKey(key) {
    return Array.from(payments.values()).find((p) => p.idempotencyKey === key) || null;
  },

  delete(id) {
    return payments.delete(id);
  },

  clear() {
    payments.clear();
  },

  size() {
    return payments.size;
  },
};

module.exports = paymentStore;
