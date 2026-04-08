/**
 * MCP SERVER - Model Context Protocol
 * 
 * Permet aux autres IA (Claude, GPT, etc.) de découvrir et utiliser tes agents
 * 
 * Standard: https://modelcontextprotocol.io
 */

const express = require('express');

function createMCPServer(agents, config = {}) {
  const router = express.Router();

  // ========================================
  // MCP DISCOVERY ENDPOINT
  // ========================================
  // Les IA appellent ça pour découvrir tes tools
  router.get('/.well-known/mcp.json', (req, res) => {
    res.json({
      schema_version: '1.0',
      name: 'DEXAI Agent Marketplace',
      description: 'AI-powered crypto tools: token analysis, wallet tracking, exit signals, code audits',
      url: config.baseUrl || req.protocol + '://' + req.get('host'),
      
      // Contact
      provider: {
        name: 'DEXAI',
        url: 'https://dexscreenerai.com',
      },
      
      // Authentication
      auth: {
        type: 'x402',
        description: 'Pay-per-use with USDC on Solana',
        payment_address: config.paymentWallet,
        network: config.network || 'solana-devnet',
      },
      
      // Available tools
      tools: [
        {
          name: 'analyze_token',
          description: 'Analyze a Solana token with DexScreener, Rugcheck, and AI verdict. Returns price, volume, holders, risk score, and trading recommendation.',
          price: { amount: 0.50, currency: 'USDC' },
          endpoint: '/api/agents/solana-analyzer/analyze',
          method: 'POST',
          parameters: {
            type: 'object',
            required: ['tokenMint'],
            properties: {
              tokenMint: { type: 'string', description: 'Solana token mint address' },
              question: { type: 'string', description: 'Specific question about the token' },
            },
          },
        },
        {
          name: 'analyze_wallet',
          description: 'Analyze a Solana wallet: portfolio breakdown, PnL estimation, trading patterns, whale detection.',
          price: { amount: 0.40, currency: 'USDC' },
          endpoint: '/api/agents/wallet-analyzer/analyze',
          method: 'POST',
          parameters: {
            type: 'object',
            required: ['walletAddress'],
            properties: {
              walletAddress: { type: 'string', description: 'Solana wallet address' },
            },
          },
        },
        {
          name: 'get_exit_signal',
          description: 'Get AI-powered exit timing for a token. Returns sell/hold signal with technical analysis.',
          price: { amount: 0.35, currency: 'USDC' },
          endpoint: '/api/agents/exit-signal/analyze',
          method: 'POST',
          parameters: {
            type: 'object',
            required: ['tokenMint'],
            properties: {
              tokenMint: { type: 'string', description: 'Solana token mint address' },
              entryPrice: { type: 'number', description: 'Your entry price (optional)' },
            },
          },
        },
        {
          name: 'track_whales',
          description: 'Track whale wallets for a token. Detect accumulation/distribution and get copy-trade signals.',
          price: { amount: 0.45, currency: 'USDC' },
          endpoint: '/api/agents/whale-tracker/track',
          method: 'POST',
          parameters: {
            type: 'object',
            required: ['tokenMint'],
            properties: {
              tokenMint: { type: 'string', description: 'Solana token mint address' },
            },
          },
        },
        {
          name: 'review_code',
          description: 'AI code review with security analysis, best practices, and refactoring suggestions.',
          price: { amount: 0.25, currency: 'USDC' },
          endpoint: '/api/agents/code-reviewer/review',
          method: 'POST',
          parameters: {
            type: 'object',
            required: ['code'],
            properties: {
              code: { type: 'string', description: 'Code to review' },
              language: { type: 'string', description: 'Programming language' },
            },
          },
        },
        {
          name: 'audit_contract',
          description: 'Security audit for Solana/Ethereum smart contracts. Finds vulnerabilities and suggests fixes.',
          price: { amount: 1.00, currency: 'USDC' },
          endpoint: '/api/agents/smart-contract-auditor/audit',
          method: 'POST',
          parameters: {
            type: 'object',
            required: ['code'],
            properties: {
              code: { type: 'string', description: 'Smart contract code' },
              type: { type: 'string', enum: ['solana-anchor', 'solana-native', 'solidity'] },
            },
          },
        },
        {
          name: 'generate_content',
          description: 'Generate crypto content: Twitter posts/threads, TikTok scripts, blog posts.',
          price: { amount: 0.20, currency: 'USDC' },
          endpoint: '/api/agents/content-writer/generate',
          method: 'POST',
          parameters: {
            type: 'object',
            required: ['topic', 'type'],
            properties: {
              topic: { type: 'string', description: 'Content topic' },
              type: { type: 'string', enum: ['twitter', 'thread', 'tiktok', 'blog'] },
              tone: { type: 'string', enum: ['professional', 'casual', 'humorous', 'hype'] },
            },
          },
        },
      ],
    });
  });

  // ========================================
  // OPENAPI / SWAGGER SPEC
  // ========================================
  router.get('/openapi.json', (req, res) => {
    const baseUrl = config.baseUrl || req.protocol + '://' + req.get('host');
    
    res.json({
      openapi: '3.0.0',
      info: {
        title: 'DEXAI Agent API',
        version: '1.0.0',
        description: 'AI-powered crypto tools with pay-per-use pricing',
        contact: { url: 'https://dexscreenerai.com' },
      },
      servers: [{ url: baseUrl }],
      paths: {
        '/api/agents/solana-analyzer/analyze': {
          post: {
            summary: 'Analyze Solana Token',
            operationId: 'analyzeToken',
            'x-price': { amount: 0.50, currency: 'USDC' },
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['tokenMint'],
                    properties: {
                      tokenMint: { type: 'string' },
                      question: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: { '200': { description: 'Token analysis result' } },
          },
        },
        '/api/agents/wallet-analyzer/analyze': {
          post: {
            summary: 'Analyze Wallet',
            operationId: 'analyzeWallet',
            'x-price': { amount: 0.40, currency: 'USDC' },
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['walletAddress'],
                    properties: { walletAddress: { type: 'string' } },
                  },
                },
              },
            },
            responses: { '200': { description: 'Wallet analysis result' } },
          },
        },
        '/api/agents/exit-signal/analyze': {
          post: {
            summary: 'Get Exit Signal',
            operationId: 'getExitSignal',
            'x-price': { amount: 0.35, currency: 'USDC' },
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['tokenMint'],
                    properties: {
                      tokenMint: { type: 'string' },
                      entryPrice: { type: 'number' },
                    },
                  },
                },
              },
            },
            responses: { '200': { description: 'Exit signal result' } },
          },
        },
        '/api/agents/whale-tracker/track': {
          post: {
            summary: 'Track Whales',
            operationId: 'trackWhales',
            'x-price': { amount: 0.45, currency: 'USDC' },
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['tokenMint'],
                    properties: { tokenMint: { type: 'string' } },
                  },
                },
              },
            },
            responses: { '200': { description: 'Whale tracking result' } },
          },
        },
      },
      components: {
        securitySchemes: {
          x402: {
            type: 'apiKey',
            in: 'header',
            name: 'X-Payment',
            description: 'USDC payment proof: USDC:{amount}:{txSignature}:{walletPubkey}',
          },
        },
      },
    });
  });

  // ========================================
  // AGENT PROTOCOL (agent-protocol.ai standard)
  // ========================================
  router.get('/agent.json', (req, res) => {
    res.json({
      name: 'DEXAI',
      description: 'AI agents for Solana traders',
      version: '1.0.0',
      capabilities: ['token-analysis', 'wallet-analysis', 'trading-signals', 'code-audit', 'content-generation'],
      pricing: {
        model: 'pay-per-use',
        currency: 'USDC',
        network: 'solana',
        wallet: config.paymentWallet,
      },
      endpoints: {
        discovery: '/.well-known/mcp.json',
        openapi: '/openapi.json',
        registry: '/api/agents/registry',
      },
    });
  });

  return router;
}

module.exports = { createMCPServer };
