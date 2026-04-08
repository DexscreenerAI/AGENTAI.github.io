/**
 * WALLET ANALYZER AGENT
 * 
 * Comprehensive Solana wallet analysis:
 * - Portfolio breakdown
 * - PnL estimation
 * - Trading patterns
 * - Risk assessment
 * - Whale detection
 * 
 * Price: $0.40 per analysis
 */

const Anthropic = require('@anthropic-ai/sdk');

class WalletAnalyzerAgent {
  constructor(config = {}) {
    this.name = 'Wallet Analyzer';
    this.description = 'AI-powered Solana wallet analysis with portfolio breakdown, PnL, and trading patterns';
    this.price = config.price || 0.40;
    this.skills = ['Solana', 'Wallet Analysis', 'Portfolio', 'PnL', 'Trading Patterns'];
    
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Fetch wallet token holdings from Helius/Solana FM
   */
  async fetchWalletTokens(walletAddress) {
    try {
      // Using Helius API (free tier available)
      const response = await fetch(`https://api.helius.xyz/v0/addresses/${walletAddress}/balances?api-key=${process.env.HELIUS_API_KEY || 'demo'}`);
      const data = await response.json();
      
      return {
        nativeBalance: data.nativeBalance / 1e9, // SOL
        tokens: (data.tokens || []).map(t => ({
          mint: t.mint,
          amount: t.amount,
          decimals: t.decimals,
          uiAmount: t.amount / Math.pow(10, t.decimals),
        })),
      };
    } catch (error) {
      // Fallback to basic RPC
      return { error: 'Could not fetch wallet data', nativeBalance: 0, tokens: [] };
    }
  }

  /**
   * Fetch transaction history
   */
  async fetchTransactionHistory(walletAddress, limit = 50) {
    try {
      const response = await fetch(`https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${process.env.HELIUS_API_KEY || 'demo'}&limit=${limit}`);
      const transactions = await response.json();
      
      return transactions.map(tx => ({
        signature: tx.signature,
        timestamp: tx.timestamp,
        type: tx.type,
        fee: tx.fee,
        status: tx.transactionError ? 'failed' : 'success',
        description: tx.description,
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Fetch DeFi positions
   */
  async fetchDeFiPositions(walletAddress) {
    try {
      // Check common DeFi protocols
      const protocols = [];
      
      // This would integrate with various DeFi protocols
      // For now, return placeholder
      return {
        protocols,
        totalValueLocked: 0,
      };
    } catch (error) {
      return { protocols: [], totalValueLocked: 0 };
    }
  }

  /**
   * Get token prices from DexScreener
   */
  async getTokenPrices(mints) {
    const prices = {};
    
    for (const mint of mints.slice(0, 10)) { // Limit to 10 tokens
      try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
        const data = await response.json();
        
        if (data.pairs && data.pairs.length > 0) {
          prices[mint] = {
            price: parseFloat(data.pairs[0].priceUsd) || 0,
            symbol: data.pairs[0].baseToken?.symbol,
            name: data.pairs[0].baseToken?.name,
            priceChange24h: data.pairs[0].priceChange?.h24,
          };
        }
      } catch (e) {
        // Skip failed fetches
      }
    }
    
    return prices;
  }

  /**
   * AI-powered analysis
   */
  async analyzeWithAI(walletData, transactions, prices) {
    const systemPrompt = `You are an expert blockchain analyst specializing in Solana wallets.
Analyze the wallet data and provide actionable insights.

Respond in JSON format:
{
  "summary": {
    "walletType": "whale|trader|holder|bot|new",
    "riskLevel": "low|medium|high",
    "activityLevel": "inactive|low|medium|high|very_high",
    "estimatedPnL": "positive|negative|neutral",
    "confidence": 0-100
  },
  "portfolio": {
    "totalValueUSD": 0,
    "topHoldings": [
      { "symbol": "...", "value": 0, "percentage": 0 }
    ],
    "diversification": "poor|moderate|good|excellent"
  },
  "tradingPatterns": {
    "style": "day_trader|swing_trader|holder|degen|sniper",
    "frequency": "trades per day/week estimate",
    "avgHoldTime": "estimated hold time",
    "preferredDEX": "most used DEX",
    "favoriteTokenTypes": ["meme", "defi", "nft", "etc"]
  },
  "insights": [
    "Key insight 1",
    "Key insight 2",
    "Key insight 3"
  ],
  "redFlags": ["Any concerning patterns"],
  "opportunities": ["Potential opportunities based on holdings"],
  "recommendation": "Overall assessment and suggestion"
}`;

    const userPrompt = `Analyze this Solana wallet:

**Holdings:**
- SOL Balance: ${walletData.nativeBalance} SOL
- Token Count: ${walletData.tokens?.length || 0}

**Top Tokens with Prices:**
${Object.entries(prices).map(([mint, data]) => {
  const token = walletData.tokens?.find(t => t.mint === mint);
  const value = token ? token.uiAmount * data.price : 0;
  return `- ${data.symbol}: ${token?.uiAmount?.toFixed(2) || 0} ($${value.toFixed(2)}) | 24h: ${data.priceChange24h}%`;
}).join('\n')}

**Recent Transactions (last ${transactions.length}):**
${transactions.slice(0, 20).map(tx => `- ${tx.type}: ${tx.description || 'Unknown'} (${new Date(tx.timestamp * 1000).toLocaleDateString()})`).join('\n')}

Provide comprehensive analysis in JSON format.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [{ role: 'user', content: userPrompt }],
        system: systemPrompt,
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: content };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Full wallet analysis
   */
  async analyze(walletAddress, options = {}) {
    const startTime = Date.now();

    // Validate address
    if (!walletAddress || walletAddress.length < 32) {
      return { success: false, error: 'Invalid wallet address' };
    }

    // Fetch all data in parallel
    const [walletData, transactions] = await Promise.all([
      this.fetchWalletTokens(walletAddress),
      this.fetchTransactionHistory(walletAddress, options.txLimit || 50),
    ]);

    // Get prices for tokens
    const tokenMints = walletData.tokens?.map(t => t.mint) || [];
    const prices = await this.getTokenPrices(tokenMints);

    // AI Analysis
    const aiAnalysis = await this.analyzeWithAI(walletData, transactions, prices);

    const analysisTime = Date.now() - startTime;

    return {
      success: true,
      walletAddress,
      data: {
        solBalance: walletData.nativeBalance,
        tokenCount: walletData.tokens?.length || 0,
        transactionCount: transactions.length,
      },
      holdings: walletData.tokens?.slice(0, 20).map(t => ({
        ...t,
        price: prices[t.mint]?.price,
        symbol: prices[t.mint]?.symbol,
        valueUSD: (t.uiAmount || 0) * (prices[t.mint]?.price || 0),
      })),
      recentTransactions: transactions.slice(0, 10),
      analysis: aiAnalysis,
      meta: {
        analysisTime: `${analysisTime}ms`,
        timestamp: new Date().toISOString(),
        cost: this.price,
      },
      links: {
        solscan: `https://solscan.io/account/${walletAddress}`,
        solanaFM: `https://solana.fm/address/${walletAddress}`,
        birdeye: `https://birdeye.so/profile/${walletAddress}?chain=solana`,
      },
    };
  }

  /**
   * Quick portfolio value
   */
  async quickPortfolio(walletAddress) {
    const walletData = await this.fetchWalletTokens(walletAddress);
    const tokenMints = walletData.tokens?.map(t => t.mint) || [];
    const prices = await this.getTokenPrices(tokenMints.slice(0, 5));

    let totalValue = walletData.nativeBalance * 150; // Approximate SOL price
    
    for (const token of walletData.tokens || []) {
      if (prices[token.mint]) {
        totalValue += token.uiAmount * prices[token.mint].price;
      }
    }

    return {
      walletAddress,
      solBalance: walletData.nativeBalance,
      tokenCount: walletData.tokens?.length || 0,
      estimatedValueUSD: totalValue,
      topTokens: Object.entries(prices).slice(0, 5).map(([mint, data]) => ({
        symbol: data.symbol,
        price: data.price,
      })),
    };
  }

  /**
   * Compare two wallets
   */
  async compareWallets(wallet1, wallet2) {
    const [analysis1, analysis2] = await Promise.all([
      this.analyze(wallet1),
      this.analyze(wallet2),
    ]);

    return {
      success: true,
      comparison: {
        wallet1: {
          address: wallet1,
          solBalance: analysis1.data?.solBalance,
          tokenCount: analysis1.data?.tokenCount,
          type: analysis1.analysis?.summary?.walletType,
          risk: analysis1.analysis?.summary?.riskLevel,
        },
        wallet2: {
          address: wallet2,
          solBalance: analysis2.data?.solBalance,
          tokenCount: analysis2.data?.tokenCount,
          type: analysis2.analysis?.summary?.walletType,
          risk: analysis2.analysis?.summary?.riskLevel,
        },
      },
      fullAnalyses: { wallet1: analysis1, wallet2: analysis2 },
    };
  }

  /**
   * Express router
   */
  router(x402, recipientWallet) {
    const express = require('express');
    const router = express.Router();

    router.get('/wallet-analyzer', (req, res) => {
      res.json({
        name: this.name,
        description: this.description,
        price: this.price,
        currency: 'USDC',
        skills: this.skills,
        endpoints: {
          analyze: 'POST /api/agents/wallet-analyzer/analyze',
          quick: 'POST /api/agents/wallet-analyzer/quick',
          compare: 'POST /api/agents/wallet-analyzer/compare',
        },
      });
    });

    router.post('/wallet-analyzer/analyze',
      x402.middleware({ price: this.price, recipient: recipientWallet }),
      async (req, res) => {
        const { walletAddress, txLimit } = req.body;
        if (!walletAddress) return res.status(400).json({ error: 'walletAddress required' });
        const result = await this.analyze(walletAddress, { txLimit });
        res.json(result);
      }
    );

    router.post('/wallet-analyzer/quick',
      x402.middleware({ price: this.price * 0.4, recipient: recipientWallet }),
      async (req, res) => {
        const { walletAddress } = req.body;
        if (!walletAddress) return res.status(400).json({ error: 'walletAddress required' });
        const result = await this.quickPortfolio(walletAddress);
        res.json(result);
      }
    );

    router.post('/wallet-analyzer/compare',
      x402.middleware({ price: this.price * 1.5, recipient: recipientWallet }),
      async (req, res) => {
        const { wallet1, wallet2 } = req.body;
        if (!wallet1 || !wallet2) return res.status(400).json({ error: 'wallet1 and wallet2 required' });
        const result = await this.compareWallets(wallet1, wallet2);
        res.json(result);
      }
    );

    return router;
  }
}

module.exports = { WalletAnalyzerAgent };
