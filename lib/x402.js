/**
 * x402 Micropayments Protocol
 */
class X402 {
  constructor(config = {}) {
    this.network = config.network || 'devnet';
    this.rpcUrl = config.rpcUrl || 'https://api.devnet.solana.com';
    this.payments = [];
    this.onPayment = null;
  }

  middleware(options) {
    const { price, recipient } = options;
    return async (req, res, next) => {
      const paymentHeader = req.headers['x-payment'];
      if (!paymentHeader) {
        return res.status(402).json({
          error: 'Payment Required',
          protocol: 'x402',
          payment: { price, currency: 'USDC', recipient }
        });
      }
      // Parse: USDC:{amount}:{signature}:{pubkey}
      const parts = paymentHeader.split(':');
      if (parts.length >= 4 && parseFloat(parts[1]) >= price) {
        const payment = { amount: parseFloat(parts[1]), signature: parts[2], payer: parts[3], endpoint: req.path, timestamp: new Date() };
        this.payments.push(payment);
        if (this.onPayment) this.onPayment(payment);
        req.x402 = payment;
        return next();
      }
      return res.status(402).json({ error: 'Invalid payment', required: price });
    };
  }

  router() {
    const express = require('express');
    const router = express.Router();
    router.get('/x402/info', (req, res) => res.json({ protocol: 'x402', network: this.network }));
    router.get('/x402/payments', (req, res) => res.json({ payments: this.payments.slice(-100) }));
    return router;
  }
}
module.exports = { X402 };
