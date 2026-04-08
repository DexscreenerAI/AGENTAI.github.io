/**
 * DEXAI Payment SDK
 * 
 * Easy integration for x402 micropayments with Solana/USDC
 * 
 * Usage:
 * ```javascript
 * import { DexaiClient } from './payment-sdk.js';
 * 
 * const client = new DexaiClient({
 *   apiUrl: 'https://your-api.railway.app',
 *   wallet: window.solana, // Phantom wallet
 * });
 * 
 * // Analyze a token
 * const result = await client.analyzeToken('EPjFWdd5...');
 * 
 * // Review code
 * const review = await client.reviewCode('const x = 1;');
 * ```
 */

class DexaiClient {
  constructor(config = {}) {
    this.apiUrl = config.apiUrl || window.location.origin;
    this.wallet = config.wallet || window.solana;
    this.publicKey = null;
    
    // Agent endpoints and prices
    this.agents = {
      'solana-analyzer': {
        analyze: { endpoint: '/api/agents/solana-analyzer/analyze', price: 0.50 },
        quickCheck: { endpoint: '/api/agents/solana-analyzer/quick-check', price: 0.20 },
        compare: { endpoint: '/api/agents/solana-analyzer/compare', price: 1.00 },
      },
      'code-reviewer': {
        review: { endpoint: '/api/agents/code-reviewer/review', price: 0.25 },
        security: { endpoint: '/api/agents/code-reviewer/security', price: 0.15 },
      },
      'smart-contract-auditor': {
        audit: { endpoint: '/api/agents/smart-contract-auditor/audit', price: 1.00 },
        quickScan: { endpoint: '/api/agents/smart-contract-auditor/quick-scan', price: 0.40 },
        fix: { endpoint: '/api/agents/smart-contract-auditor/fix', price: 0.50 },
        report: { endpoint: '/api/agents/smart-contract-auditor/report', price: 0.30 },
      },
      'content-writer': {
        generate: { endpoint: '/api/agents/content-writer/generate', price: 0.20 },
        thread: { endpoint: '/api/agents/content-writer/thread', price: 0.30 },
        tiktok: { endpoint: '/api/agents/content-writer/tiktok', price: 0.24 },
        rewrite: { endpoint: '/api/agents/content-writer/rewrite', price: 0.20 },
        calendar: { endpoint: '/api/agents/content-writer/calendar', price: 0.60 },
      },
    };
  }

  /**
   * Connect to wallet
   */
  async connect() {
    if (!this.wallet) {
      throw new Error('No wallet found. Install Phantom: https://phantom.app');
    }
    
    const response = await this.wallet.connect();
    this.publicKey = response.publicKey.toString();
    return this.publicKey;
  }

  /**
   * Check if connected
   */
  isConnected() {
    return !!this.publicKey;
  }

  /**
   * Create payment signature
   */
  async createPaymentSignature(amount) {
    if (!this.publicKey) {
      await this.connect();
    }

    const message = `DEXAI Payment: ${amount} USDC`;
    const encodedMessage = new TextEncoder().encode(message);
    
    const { signature } = await this.wallet.signMessage(encodedMessage, 'utf8');
    return btoa(String.fromCharCode(...signature));
  }

  /**
   * Make a paid API call
   */
  async callAgent(endpoint, price, body) {
    if (!this.publicKey) {
      await this.connect();
    }

    // Get payment signature
    const signature = await this.createPaymentSignature(price);

    // Make API call with payment header
    const response = await fetch(this.apiUrl + endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment': `USDC:${price}:${signature}:${this.publicKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `API error: ${response.status}`);
    }

    return data;
  }

  // ===========================
  // SOLANA ANALYZER
  // ===========================

  /**
   * Full token analysis
   * @param {string} tokenMint - Solana token mint address
   * @param {string} question - Optional specific question
   * @returns {Promise<object>} Analysis result
   */
  async analyzeToken(tokenMint, question = null) {
    const { endpoint, price } = this.agents['solana-analyzer'].analyze;
    return this.callAgent(endpoint, price, { tokenMint, question });
  }

  /**
   * Quick risk check
   * @param {string} tokenMint - Solana token mint address
   * @returns {Promise<object>} Risk assessment
   */
  async quickCheck(tokenMint) {
    const { endpoint, price } = this.agents['solana-analyzer'].quickCheck;
    return this.callAgent(endpoint, price, { tokenMint });
  }

  /**
   * Compare multiple tokens
   * @param {string[]} tokenMints - Array of token mint addresses (2-5)
   * @returns {Promise<object>} Comparison result
   */
  async compareTokens(tokenMints) {
    const { endpoint, price } = this.agents['solana-analyzer'].compare;
    return this.callAgent(endpoint, price, { tokenMints });
  }

  // ===========================
  // CODE REVIEWER
  // ===========================

  /**
   * Full code review
   * @param {string} code - Code to review
   * @param {object} options - { language, focusAreas, context }
   * @returns {Promise<object>} Review result
   */
  async reviewCode(code, options = {}) {
    const { endpoint, price } = this.agents['code-reviewer'].review;
    return this.callAgent(endpoint, price, { code, ...options });
  }

  /**
   * Security scan only
   * @param {string} code - Code to scan
   * @param {string} language - Programming language
   * @returns {Promise<object>} Security findings
   */
  async securityScan(code, language = 'auto') {
    const { endpoint, price } = this.agents['code-reviewer'].security;
    return this.callAgent(endpoint, price, { code, language });
  }

  // ===========================
  // SMART CONTRACT AUDITOR
  // ===========================

  /**
   * Full smart contract audit
   * @param {string} code - Contract code
   * @param {object} options - { contractType, context, focusAreas }
   * @returns {Promise<object>} Audit result
   */
  async auditContract(code, options = {}) {
    const { endpoint, price } = this.agents['smart-contract-auditor'].audit;
    return this.callAgent(endpoint, price, { code, ...options });
  }

  /**
   * Quick vulnerability scan
   * @param {string} code - Contract code
   * @returns {Promise<object>} Vulnerabilities found
   */
  async quickScanContract(code) {
    const { endpoint, price } = this.agents['smart-contract-auditor'].quickScan;
    return this.callAgent(endpoint, price, { code });
  }

  /**
   * Generate fix for vulnerability
   * @param {string} code - Contract code
   * @param {string} vulnerability - Vulnerability description
   * @returns {Promise<object>} Fixed code
   */
  async generateFix(code, vulnerability) {
    const { endpoint, price } = this.agents['smart-contract-auditor'].fix;
    return this.callAgent(endpoint, price, { code, vulnerability });
  }

  // ===========================
  // CONTENT WRITER
  // ===========================

  /**
   * Generate content
   * @param {object} options - { type, topic, tone, audience, keywords, length }
   * @returns {Promise<object>} Generated content
   */
  async generateContent(options) {
    const { endpoint, price } = this.agents['content-writer'].generate;
    return this.callAgent(endpoint, price, options);
  }

  /**
   * Generate Twitter thread
   * @param {string} topic - Thread topic
   * @param {object} options - { tweets, tone, audience }
   * @returns {Promise<object>} Thread content
   */
  async generateThread(topic, options = {}) {
    const { endpoint, price } = this.agents['content-writer'].thread;
    return this.callAgent(endpoint, price, { topic, ...options });
  }

  /**
   * Generate TikTok script
   * @param {string} topic - Video topic
   * @param {object} options - { duration, style, hook }
   * @returns {Promise<object>} Script with visual cues
   */
  async generateTikTok(topic, options = {}) {
    const { endpoint, price } = this.agents['content-writer'].tiktok;
    return this.callAgent(endpoint, price, { topic, ...options });
  }

  /**
   * Rewrite content
   * @param {string} content - Content to rewrite
   * @param {object} options - { goal, targetPlatform, tone }
   * @returns {Promise<object>} Rewritten content
   */
  async rewriteContent(content, options = {}) {
    const { endpoint, price } = this.agents['content-writer'].rewrite;
    return this.callAgent(endpoint, price, { content, ...options });
  }

  /**
   * Generate content calendar
   * @param {string} niche - Content niche
   * @param {object} options - { days, platforms, postsPerDay }
   * @returns {Promise<object>} Content calendar
   */
  async generateCalendar(niche, options = {}) {
    const { endpoint, price } = this.agents['content-writer'].calendar;
    return this.callAgent(endpoint, price, { niche, ...options });
  }

  // ===========================
  // UTILITIES
  // ===========================

  /**
   * Get all agents info
   */
  async getAgents() {
    const response = await fetch(this.apiUrl + '/api/agents/registry');
    return response.json();
  }

  /**
   * Get pricing for all agents
   */
  getPricing() {
    const pricing = {};
    for (const [agent, methods] of Object.entries(this.agents)) {
      pricing[agent] = {};
      for (const [method, { price }] of Object.entries(methods)) {
        pricing[agent][method] = price;
      }
    }
    return pricing;
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DexaiClient };
}

if (typeof window !== 'undefined') {
  window.DexaiClient = DexaiClient;
}

export { DexaiClient };
