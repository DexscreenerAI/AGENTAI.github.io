/**
 * DEXAI AGENT - x402 Payment SDK
 * 
 * Client SDK for making paid API calls to DEXAI AGENT
 * Supports Phantom, Solflare, and other Solana wallets
 * 
 * Usage:
 *   const client = new DexAIClient({ apiUrl: 'https://your-api.com' });
 *   await client.connect(); // Connect wallet
 *   const result = await client.solanaAnalyzer.analyze('token_mint_address');
 */

class DexAIClient {
  constructor(config = {}) {
    this.apiUrl = config.apiUrl || window.location.origin;
    this.wallet = null;
    this.publicKey = null;
    this.network = config.network || 'devnet';
    
    // USDC mint addresses
    this.USDC_MINT = this.network === 'mainnet-beta' 
      ? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      : '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
    
    // Initialize agent interfaces
    this.solanaAnalyzer = new SolanaAnalyzerClient(this);
    this.codeReviewer = new CodeReviewerClient(this);
    this.smartContractAuditor = new SmartContractAuditorClient(this);
    this.contentWriter = new ContentWriterClient(this);
  }

  /**
   * Connect to Phantom or Solflare wallet
   */
  async connect() {
    // Try Phantom first
    let provider = window.phantom?.solana;
    
    // Fallback to Solflare
    if (!provider?.isPhantom) {
      provider = window.solflare;
    }
    
    if (!provider) {
      throw new Error('No Solana wallet found. Please install Phantom or Solflare.');
    }
    
    try {
      const resp = await provider.connect();
      this.wallet = provider;
      this.publicKey = resp.publicKey.toString();
      
      console.log('✅ Wallet connected:', this.publicKey);
      return { connected: true, publicKey: this.publicKey };
    } catch (err) {
      throw new Error('Wallet connection rejected: ' + err.message);
    }
  }

  /**
   * Disconnect wallet
   */
  async disconnect() {
    if (this.wallet) {
      await this.wallet.disconnect();
      this.wallet = null;
      this.publicKey = null;
    }
  }

  /**
   * Check if wallet is connected
   */
  isConnected() {
    return this.wallet !== null && this.publicKey !== null;
  }

  /**
   * Get USDC balance
   */
  async getUSDCBalance() {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected');
    }
    
    // In production, query the actual token account
    // This is simplified for demo
    try {
      const response = await fetch(`${this.apiUrl}/api/x402/balance/${this.publicKey}`);
      const data = await response.json();
      return data.balance || 0;
    } catch (err) {
      console.warn('Could not fetch balance:', err);
      return 0;
    }
  }

  /**
   * Sign a message with wallet
   */
  async signMessage(message) {
    if (!this.wallet) {
      throw new Error('Wallet not connected');
    }
    
    const encodedMessage = new TextEncoder().encode(message);
    const signature = await this.wallet.signMessage(encodedMessage, 'utf8');
    
    // Convert signature to base58
    return this._toBase58(signature.signature);
  }

  /**
   * Create x402 payment header
   */
  async createPaymentHeader(amount) {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected. Call connect() first.');
    }
    
    // Create payment message
    const timestamp = Date.now();
    const message = `x402:${amount}:${timestamp}:${this.publicKey}`;
    
    // Sign with wallet
    const signature = await this.signMessage(message);
    
    // Format: USDC:{amount}:{signature}:{pubkey}
    return `USDC:${amount}:${signature}:${this.publicKey}`;
  }

  /**
   * Make a paid API request
   */
  async paidRequest(endpoint, body, price) {
    // Create payment header
    const paymentHeader = this.isConnected() 
      ? await this.createPaymentHeader(price)
      : `USDC:${price}:demo:demo`;
    
    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment': paymentHeader,
      },
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    
    if (response.status === 402) {
      throw new PaymentRequiredError(data.payment || { price, currency: 'USDC' });
    }
    
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    
    return data;
  }

  /**
   * Get available agents
   */
  async getAgents() {
    const response = await fetch(`${this.apiUrl}/api/agents/registry`);
    return response.json();
  }

  /**
   * Get x402 protocol info
   */
  async getPaymentInfo() {
    const response = await fetch(`${this.apiUrl}/api/x402/info`);
    return response.json();
  }

  // Utility: Convert bytes to base58
  _toBase58(bytes) {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let result = '';
    let num = BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''));
    while (num > 0) {
      result = ALPHABET[Number(num % 58n)] + result;
      num = num / 58n;
    }
    return result || '1';
  }
}

/**
 * Payment Required Error
 */
class PaymentRequiredError extends Error {
  constructor(payment) {
    super(`Payment required: ${payment.price} ${payment.currency}`);
    this.name = 'PaymentRequiredError';
    this.payment = payment;
  }
}

/**
 * Solana Analyzer Client
 */
class SolanaAnalyzerClient {
  constructor(client) {
    this.client = client;
    this.baseEndpoint = '/api/agents/solana-analyzer';
    this.prices = {
      analyze: 0.50,
      quickCheck: 0.20,
      compare: 1.00,
    };
  }

  /**
   * Full token analysis
   * @param {string} tokenMint - Solana token mint address
   * @param {object} options - { question?: string }
   */
  async analyze(tokenMint, options = {}) {
    return this.client.paidRequest(
      `${this.baseEndpoint}/analyze`,
      { tokenMint, ...options },
      this.prices.analyze
    );
  }

  /**
   * Quick risk check
   * @param {string} tokenMint - Solana token mint address
   */
  async quickCheck(tokenMint) {
    return this.client.paidRequest(
      `${this.baseEndpoint}/quick-check`,
      { tokenMint },
      this.prices.quickCheck
    );
  }

  /**
   * Compare multiple tokens
   * @param {string[]} tokenMints - Array of token mint addresses (2-5)
   */
  async compare(tokenMints) {
    return this.client.paidRequest(
      `${this.baseEndpoint}/compare`,
      { tokenMints },
      this.prices.compare
    );
  }
}

/**
 * Code Reviewer Client
 */
class CodeReviewerClient {
  constructor(client) {
    this.client = client;
    this.baseEndpoint = '/api/agents/code-reviewer';
    this.prices = {
      review: 0.25,
      security: 0.15,
    };
  }

  /**
   * Full code review
   * @param {string} code - Code to review
   * @param {object} options - { language?, focusAreas?, context? }
   */
  async review(code, options = {}) {
    return this.client.paidRequest(
      `${this.baseEndpoint}/review`,
      { code, ...options },
      this.prices.review
    );
  }

  /**
   * Security scan only
   * @param {string} code - Code to scan
   * @param {string} language - Programming language
   */
  async security(code, language = 'auto') {
    return this.client.paidRequest(
      `${this.baseEndpoint}/security`,
      { code, language },
      this.prices.security
    );
  }
}

/**
 * Smart Contract Auditor Client
 */
class SmartContractAuditorClient {
  constructor(client) {
    this.client = client;
    this.baseEndpoint = '/api/agents/smart-contract-auditor';
    this.prices = {
      audit: 1.00,
      quickScan: 0.40,
      fix: 0.50,
      compare: 0.60,
      report: 0.30,
    };
  }

  /**
   * Full security audit
   * @param {string} code - Smart contract code
   * @param {object} options - { contractType?, context?, focusAreas? }
   */
  async audit(code, options = {}) {
    return this.client.paidRequest(
      `${this.baseEndpoint}/audit`,
      { code, ...options },
      this.prices.audit
    );
  }

  /**
   * Quick vulnerability scan
   * @param {string} code - Smart contract code
   */
  async quickScan(code) {
    return this.client.paidRequest(
      `${this.baseEndpoint}/quick-scan`,
      { code },
      this.prices.quickScan
    );
  }

  /**
   * Generate fix for vulnerability
   * @param {string} code - Original code
   * @param {string} vulnerability - Vulnerability to fix
   */
  async fix(code, vulnerability) {
    return this.client.paidRequest(
      `${this.baseEndpoint}/fix`,
      { code, vulnerability },
      this.prices.fix
    );
  }

  /**
   * Compare two versions
   * @param {string} oldCode - Old version
   * @param {string} newCode - New version
   */
  async compare(oldCode, newCode) {
    return this.client.paidRequest(
      `${this.baseEndpoint}/compare`,
      { oldCode, newCode },
      this.prices.compare
    );
  }

  /**
   * Generate audit report
   * @param {object} auditResult - Result from audit()
   * @param {object} options - { projectName?, auditor? }
   */
  async report(auditResult, options = {}) {
    return this.client.paidRequest(
      `${this.baseEndpoint}/report`,
      { auditResult, ...options },
      this.prices.report
    );
  }
}

/**
 * Content Writer Client
 */
class ContentWriterClient {
  constructor(client) {
    this.client = client;
    this.baseEndpoint = '/api/agents/content-writer';
    this.prices = {
      generate: 0.20,
      thread: 0.30,
      tiktok: 0.24,
      rewrite: 0.20,
      calendar: 0.60,
    };
  }

  /**
   * Generate content
   * @param {object} options - { type, topic, tone?, audience?, keywords?, length? }
   */
  async generate(options) {
    return this.client.paidRequest(
      `${this.baseEndpoint}/generate`,
      options,
      this.prices.generate
    );
  }

  /**
   * Generate Twitter thread
   * @param {string} topic - Thread topic
   * @param {object} options - { tweets?, tone?, audience? }
   */
  async thread(topic, options = {}) {
    return this.client.paidRequest(
      `${this.baseEndpoint}/thread`,
      { topic, ...options },
      this.prices.thread
    );
  }

  /**
   * Generate TikTok script
   * @param {string} topic - Video topic
   * @param {object} options - { duration?, style?, hook? }
   */
  async tiktok(topic, options = {}) {
    return this.client.paidRequest(
      `${this.baseEndpoint}/tiktok`,
      { topic, ...options },
      this.prices.tiktok
    );
  }

  /**
   * Rewrite content
   * @param {string} content - Original content
   * @param {object} options - { goal?, targetPlatform?, tone? }
   */
  async rewrite(content, options = {}) {
    return this.client.paidRequest(
      `${this.baseEndpoint}/rewrite`,
      { content, ...options },
      this.prices.rewrite
    );
  }

  /**
   * Generate content calendar
   * @param {string} niche - Content niche
   * @param {object} options - { days?, platforms?, postsPerDay? }
   */
  async calendar(niche, options = {}) {
    return this.client.paidRequest(
      `${this.baseEndpoint}/calendar`,
      { niche, ...options },
      this.prices.calendar
    );
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DexAIClient, PaymentRequiredError };
} else {
  window.DexAIClient = DexAIClient;
  window.PaymentRequiredError = PaymentRequiredError;
}
