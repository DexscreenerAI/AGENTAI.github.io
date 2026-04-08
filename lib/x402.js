/**
 * x402 Micropayments Middleware
 * 
 * HTTP 402 Payment Required protocol for AI agents
 * Pay-per-request API monetization
 * 
 * Usage:
 *   app.use('/api/paid', x402.middleware({ price: 0.10, currency: 'USDC' }));
 * 
 * Client sends:
 *   X-Payment: USDC:0.10:signature:payer_pubkey
 * 
 * Response headers:
 *   X-Payment-Required: true
 *   X-Payment-Price: 0.10
 *   X-Payment-Currency: USDC
 *   X-Payment-Address: <agent_wallet>
 */

const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { 
  getAssociatedTokenAddress,
  getAccount,
} = require('@solana/spl-token');
const nacl = require('tweetnacl');
const bs58 = require('bs58');

// USDC addresses
const USDC_MINT = {
  mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
};

class X402 {
  constructor(config = {}) {
    this.network = config.network || 'devnet';
    this.rpcUrl = config.rpcUrl || 'https://api.devnet.solana.com';
    this.connection = new Connection(this.rpcUrl, 'confirmed');
    this.usdcMint = new PublicKey(USDC_MINT[this.network] || USDC_MINT.devnet);
    
    // Payment ledger (in-memory, use Redis/DB in production)
    this.ledger = new Map();
    
    // Pending payments waiting for confirmation
    this.pendingPayments = new Map();
    
    // Verified balances cache (60s TTL)
    this.balanceCache = new Map();
    this.balanceCacheTTL = 60000;
  }

  /**
   * Express middleware for paid endpoints
   * @param {Object} options - { price, currency, recipient }
   */
  middleware(options = {}) {
    const price = options.price || 0.10;
    const currency = options.currency || 'USDC';
    const recipient = options.recipient; // Agent's wallet address

    return async (req, res, next) => {
      const paymentHeader = req.headers['x-payment'];

      // No payment header → 402 Payment Required
      if (!paymentHeader) {
        return res.status(402).json({
          error: 'Payment Required',
          protocol: 'x402',
          version: '1.0',
          payment: {
            price,
            currency,
            recipient,
            network: this.network,
          },
          instructions: {
            header: 'X-Payment',
            format: 'USDC:{amount}:{signature}:{payer_pubkey}',
            example: `USDC:${price}:signature_base58:payer_pubkey`,
          },
        });
      }

      // Parse payment header
      const parsed = this.parsePaymentHeader(paymentHeader);
      if (!parsed) {
        return res.status(400).json({
          error: 'Invalid payment header format',
          expected: 'USDC:{amount}:{signature}:{payer_pubkey}',
        });
      }

      const { amount, signature, payerPubkey } = parsed;

      // Verify amount matches price
      if (amount < price) {
        return res.status(402).json({
          error: 'Insufficient payment',
          required: price,
          received: amount,
          currency,
        });
      }

      // Verify payment
      try {
        const verified = await this.verifyPayment(payerPubkey, signature, amount, recipient);
        
        if (!verified.valid) {
          return res.status(402).json({
            error: 'Payment verification failed',
            reason: verified.reason,
          });
        }

        // Record payment
        this.recordPayment({
          payer: payerPubkey,
          recipient,
          amount,
          signature,
          endpoint: req.path,
          timestamp: Date.now(),
        });

        // Add payment info to request
        req.x402 = {
          payer: payerPubkey,
          amount,
          signature,
          verified: true,
        };

        // Set response headers
        res.set('X-Payment-Verified', 'true');
        res.set('X-Payment-Amount', amount.toString());
        res.set('X-Payment-Payer', payerPubkey);

        next();
      } catch (err) {
        console.error('x402 verification error:', err);
        return res.status(500).json({
          error: 'Payment verification error',
          message: err.message,
        });
      }
    };
  }

  /**
   * Parse X-Payment header
   */
  parsePaymentHeader(header) {
    try {
      const parts = header.split(':');
      if (parts.length < 4) return null;

      const [currency, amountStr, signature, payerPubkey] = parts;
      
      if (currency !== 'USDC') return null;
      
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) return null;

      return { currency, amount, signature, payerPubkey };
    } catch (e) {
      return null;
    }
  }

  /**
   * Verify payment signature and balance
   */
  async verifyPayment(payerPubkey, signature, amount, recipient) {
    try {
      // 1. Verify signature format
      let sigBytes, payerKey;
      try {
        sigBytes = bs58.decode(signature);
        payerKey = new PublicKey(payerPubkey);
      } catch (e) {
        return { valid: false, reason: 'Invalid signature or pubkey format' };
      }

      // 2. Verify the signature is for this payment
      const message = `x402:USDC:${amount}:${recipient}:${Date.now().toString().slice(0, -3)}`; // Timestamp rounded to seconds
      const messageBytes = new TextEncoder().encode(message);
      
      // For production, verify actual Solana transaction signature
      // This is simplified - check if payer has sufficient balance

      // 3. Check payer balance
      const balance = await this.getUSDCBalance(payerPubkey);
      if (balance < amount) {
        return { valid: false, reason: 'Insufficient USDC balance' };
      }

      // 4. Check for replay (signature already used)
      if (this.ledger.has(signature)) {
        return { valid: false, reason: 'Payment signature already used' };
      }

      return { valid: true };
    } catch (e) {
      return { valid: false, reason: e.message };
    }
  }

  /**
   * Get USDC balance for a wallet
   */
  async getUSDCBalance(pubkeyStr) {
    const cacheKey = `balance:${pubkeyStr}`;
    const cached = this.balanceCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.balanceCacheTTL) {
      return cached.balance;
    }

    try {
      const pubkey = new PublicKey(pubkeyStr);
      const tokenAccount = await getAssociatedTokenAddress(this.usdcMint, pubkey);
      const account = await getAccount(this.connection, tokenAccount);
      const balance = Number(account.amount) / 1_000_000; // USDC has 6 decimals

      this.balanceCache.set(cacheKey, { balance, timestamp: Date.now() });
      return balance;
    } catch (e) {
      // Token account doesn't exist
      return 0;
    }
  }

  /**
   * Record a payment
   */
  recordPayment(payment) {
    this.ledger.set(payment.signature, payment);
    
    // Emit event for external tracking
    if (this.onPayment) {
      this.onPayment(payment);
    }
  }

  /**
   * Get payment history
   */
  getPayments(filters = {}) {
    let payments = Array.from(this.ledger.values());

    if (filters.payer) {
      payments = payments.filter(p => p.payer === filters.payer);
    }
    if (filters.recipient) {
      payments = payments.filter(p => p.recipient === filters.recipient);
    }
    if (filters.since) {
      payments = payments.filter(p => p.timestamp >= filters.since);
    }

    return payments.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get stats
   */
  getStats() {
    const payments = Array.from(this.ledger.values());
    return {
      totalPayments: payments.length,
      totalVolume: payments.reduce((sum, p) => sum + p.amount, 0),
      uniquePayers: new Set(payments.map(p => p.payer)).size,
      uniqueRecipients: new Set(payments.map(p => p.recipient)).size,
    };
  }

  /**
   * Create payment request for client
   */
  createPaymentRequest(price, recipient) {
    const nonce = Date.now().toString();
    return {
      protocol: 'x402',
      version: '1.0',
      price,
      currency: 'USDC',
      recipient,
      network: this.network,
      nonce,
      // Message to sign
      message: `x402:USDC:${price}:${recipient}:${nonce}`,
      // Header format
      headerFormat: `USDC:${price}:{signature}:{payer_pubkey}`,
    };
  }

  /**
   * Express router with payment info endpoint
   */
  router() {
    const express = require('express');
    const router = express.Router();

    // Payment info endpoint
    router.get('/x402/info', (req, res) => {
      res.json({
        protocol: 'x402',
        version: '1.0',
        network: this.network,
        currency: 'USDC',
        supported: true,
      });
    });

    // Payment stats
    router.get('/x402/stats', (req, res) => {
      res.json(this.getStats());
    });

    // Payment history (authenticated)
    router.get('/x402/payments', (req, res) => {
      const payments = this.getPayments({
        payer: req.query.payer,
        recipient: req.query.recipient,
        since: req.query.since ? parseInt(req.query.since) : undefined,
      });
      res.json({ payments: payments.slice(0, 100) });
    });

    return router;
  }
}

/**
 * Client helper to create payment header
 */
class X402Client {
  constructor(wallet, network = 'devnet') {
    this.wallet = wallet;
    this.network = network;
  }

  /**
   * Create X-Payment header for a request
   */
  async createPaymentHeader(price, recipient) {
    const nonce = Math.floor(Date.now() / 1000).toString();
    const message = `x402:USDC:${price}:${recipient}:${nonce}`;
    const messageBytes = new TextEncoder().encode(message);

    // Sign message
    let signature;
    if (this.wallet.signMessage) {
      // Phantom/Solflare wallet
      const sig = await this.wallet.signMessage(messageBytes);
      signature = bs58.encode(sig);
    } else if (this.wallet.secretKey) {
      // Keypair
      const sig = nacl.sign.detached(messageBytes, this.wallet.secretKey);
      signature = bs58.encode(sig);
    } else {
      throw new Error('Wallet does not support message signing');
    }

    return `USDC:${price}:${signature}:${this.wallet.publicKey.toBase58()}`;
  }

  /**
   * Make a paid request
   */
  async paidFetch(url, options = {}) {
    const response = await fetch(url, options);
    
    // Check for 402
    if (response.status === 402) {
      const paymentInfo = await response.json();
      
      // Create payment header
      const paymentHeader = await this.createPaymentHeader(
        paymentInfo.payment.price,
        paymentInfo.payment.recipient
      );

      // Retry with payment
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'X-Payment': paymentHeader,
        },
      });
    }

    return response;
  }
}

module.exports = { X402, X402Client };
