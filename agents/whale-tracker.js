/**
 * WHALE TRACKER AGENT
 * 
 * Track big wallets and their movements:
 * - Identify whale wallets for any token
 * - Track recent whale transactions
 * - Detect accumulation/distribution
 * - Copy-trade signals
 * 
 * Price: $0.45 per analysis
 */

const Anthropic = require('@anthropic-ai/sdk');

class WhaleTrackerAgent {
  constructor(config = {}) {
    this.name = 'Whale Tracker';
    this.description = 'Track whale wallets, detect accumulation/distribution, and get copy-trade signals';
    this.price = config.price || 0.45;
    this.skills = ['Whale Tracking', 'On-chain Analysis', 'Copy Trading', 'Accumulation Detection'];
    
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    });

    // Known whale wallets (would be expanded with real data)
    this.knownWhales = {
      'So11111111111111111111111111111111111111112': 'SOL Treasury',
      // Add known whale addresses here
    };
  }

  /**
   * Fetch top holders for a token
   */
  async fetchTopHolders(tokenMint) {
    try {
      // Using Rugcheck API for holder data
      const response = await fetch(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report/summary`);
      const data = await response.json();
      
      return {
        totalHolders: data.totalHolders || 0,
        topHolders: (data.topHolders || []).slice(0, 20).map((h, i) => ({
          rank: i + 1,
          address: h.address,
          percentage: h.pct,
          isInsider: h.isInsider || false,
          label: this.knownWhales[h.address] || null,
        })),
        concentration: {
          top5: data.topHolders?.slice(0, 5).reduce((a, h) => a + (h.pct || 0), 0) || 0,
          top10: data.topHolders?.slice(0, 10).reduce((a, h) => a + (h.pct || 0), 0) || 0,
          top20: data.topHolders?.slice(0, 20).reduce((a, h) => a + (h.pct || 0), 0) || 0,
        },
      };
    } catch (error) {
      return { error: error.message, topHolders: [], totalHolders: 0 };
    }
  }

  /**
   * Fetch token info from DexScreener
   */
  async fetchTokenInfo(tokenMint) {
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`);
      const data = await response.json();
      
      if (!data.pairs || data.pairs.length === 0) {
        return { error: 'Token not found' };
      }

      const pair = data.pairs[0];
      return {
        symbol: pair.baseToken?.symbol,
        name: pair.baseToken?.name,
        price: parseFloat(pair.priceUsd),
        marketCap: pair.marketCap,
        liquidity: pair.liquidity?.usd,
        volume24h: pair.volume?.h24,
        priceChange24h: pair.priceChange?.h24,
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Fetch recent large transactions (simulated - would use Helius/Birdeye in production)
   */
  async fetchWhaleTransactions(tokenMint, minUsdValue = 10000) {
    try {
      // In production, this would use Helius Enhanced Transactions API
      // For now, we'll return structured placeholder that shows the format
      
      // Simulated whale transactions based on token activity
      const tokenInfo = await this.fetchTokenInfo(tokenMint);
      
      if (tokenInfo.error) {
        return { transactions: [], error: tokenInfo.error };
      }

      // Would fetch real transactions here
      return {
        transactions: [],
        note: 'Real-time whale transactions require Helius API key',
        tokenPrice: tokenInfo.price,
      };
    } catch (error) {
      return { transactions: [], error: error.message };
    }
  }

  /**
   * Analyze holder changes (accumulation/distribution)
   */
  analyzeHolderPatterns(holders) {
    if (!holders || holders.length === 0) {
      return { pattern: 'UNKNOWN', confidence: 0 };
    }

    const top5Pct = holders.slice(0, 5).reduce((a, h) => a + (h.percentage || 0), 0);
    const top10Pct = holders.slice(0, 10).reduce((a, h) => a + (h.percentage || 0), 0);
    
    // Analyze concentration
    let pattern = 'NEUTRAL';
    let risk = 'MEDIUM';
    let confidence = 50;

    if (top5Pct > 50) {
      pattern = 'HIGHLY_CONCENTRATED';
      risk = 'HIGH';
      confidence = 80;
    } else if (top5Pct > 30) {
      pattern = 'CONCENTRATED';
      risk = 'MEDIUM';
      confidence = 70;
    } else if (top10Pct < 20) {
      pattern = 'WELL_DISTRIBUTED';
      risk = 'LOW';
      confidence = 75;
    }

    // Check for insider concentration
    const insiderCount = holders.filter(h => h.isInsider).length;
    const insiderPct = holders.filter(h => h.isInsider).reduce((a, h) => a + (h.percentage || 0), 0);

    return {
      pattern,
      risk,
      confidence,
      metrics: {
        top5Concentration: top5Pct.toFixed(2) + '%',
        top10Concentration: top10Pct.toFixed(2) + '%',
        insiderCount,
        insiderPercentage: insiderPct.toFixed(2) + '%',
      },
    };
  }

  /**
   * AI-powered whale analysis
   */
  async analyzeWithAI(tokenInfo, holders, holderPatterns) {
    const systemPrompt = `You are an expert on-chain analyst specializing in whale tracking and smart money analysis.

Analyze the holder data and provide actionable insights about whale behavior.

Respond in JSON:
{
  "summary": {
    "whaleActivity": "accumulating|distributing|holding|mixed",
    "smartMoneySignal": "bullish|bearish|neutral",
    "riskLevel": "low|medium|high|extreme",
    "confidence": 0-100
  },
  "whaleInsights": [
    {
      "observation": "What the whale is doing",
      "implication": "What it means for price",
      "actionable": "What traders should consider"
    }
  ],
  "concentrationAnalysis": {
    "assessment": "Assessment of holder concentration",
    "rugRisk": "low|medium|high",
    "reasoning": "Why"
  },
  "copyTradeSignal": {
    "action": "BUY|SELL|HOLD|AVOID",
    "reasoning": "Why follow or not follow whales",
    "timing": "When to act"
  },
  "alerts": ["Important alerts about whale activity"],
  "recommendation": "Overall recommendation"
}`;

    const userPrompt = `Analyze whale activity for ${tokenInfo.symbol}:

**Token Info:**
- Price: $${tokenInfo.price}
- Market Cap: $${tokenInfo.marketCap?.toLocaleString()}
- Liquidity: $${tokenInfo.liquidity?.toLocaleString()}
- 24h Volume: $${tokenInfo.volume24h?.toLocaleString()}
- 24h Change: ${tokenInfo.priceChange24h}%

**Holder Analysis:**
- Total Holders: ${holders.totalHolders}
- Top 5 Control: ${holderPatterns.metrics?.top5Concentration}
- Top 10 Control: ${holderPatterns.metrics?.top10Concentration}
- Pattern: ${holderPatterns.pattern}
- Risk: ${holderPatterns.risk}

**Top 10 Holders:**
${holders.topHolders?.slice(0, 10).map(h => 
  `${h.rank}. ${h.address.slice(0, 6)}...${h.address.slice(-4)}: ${h.percentage?.toFixed(2)}%${h.isInsider ? ' [INSIDER]' : ''}${h.label ? ` [${h.label}]` : ''}`
).join('\n')}

Provide whale tracking analysis in JSON format.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
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
   * Full whale tracking analysis
   */
  async trackWhales(tokenMint, options = {}) {
    const startTime = Date.now();

    // Fetch all data
    const [tokenInfo, holders] = await Promise.all([
      this.fetchTokenInfo(tokenMint),
      this.fetchTopHolders(tokenMint),
    ]);

    if (tokenInfo.error) {
      return { success: false, error: tokenInfo.error };
    }

    // Analyze patterns
    const holderPatterns = this.analyzeHolderPatterns(holders.topHolders);

    // AI Analysis
    const aiAnalysis = await this.analyzeWithAI(tokenInfo, holders, holderPatterns);

    const analysisTime = Date.now() - startTime;

    return {
      success: true,
      tokenMint,
      token: {
        symbol: tokenInfo.symbol,
        name: tokenInfo.name,
        price: tokenInfo.price,
        marketCap: tokenInfo.marketCap,
        priceChange24h: tokenInfo.priceChange24h,
      },
      holders: {
        total: holders.totalHolders,
        concentration: holders.concentration,
        top10: holders.topHolders?.slice(0, 10),
      },
      patterns: holderPatterns,
      analysis: aiAnalysis,
      meta: {
        analysisTime: `${analysisTime}ms`,
        timestamp: new Date().toISOString(),
        cost: this.price,
      },
      links: {
        rugcheck: `https://rugcheck.xyz/tokens/${tokenMint}`,
        birdeye: `https://birdeye.so/token/${tokenMint}?chain=solana`,
        solscan: `https://solscan.io/token/${tokenMint}`,
      },
    };
  }

  /**
   * Quick holder check
   */
  async quickHolderCheck(tokenMint) {
    const holders = await this.fetchTopHolders(tokenMint);
    const patterns = this.analyzeHolderPatterns(holders.topHolders);

    return {
      success: true,
      tokenMint,
      totalHolders: holders.totalHolders,
      concentration: holders.concentration,
      pattern: patterns.pattern,
      risk: patterns.risk,
      top5: holders.topHolders?.slice(0, 5).map(h => ({
        address: h.address.slice(0, 8) + '...',
        percentage: h.percentage,
        isInsider: h.isInsider,
      })),
    };
  }

  /**
   * Track specific whale wallet
   */
  async trackWallet(walletAddress, options = {}) {
    try {
      // Fetch wallet's token holdings
      const response = await fetch(`https://api.helius.xyz/v0/addresses/${walletAddress}/balances?api-key=${process.env.HELIUS_API_KEY || 'demo'}`);
      const data = await response.json();

      const holdings = [];
      
      // Get top holdings with prices
      for (const token of (data.tokens || []).slice(0, 10)) {
        try {
          const priceRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.mint}`);
          const priceData = await priceRes.json();
          
          if (priceData.pairs && priceData.pairs.length > 0) {
            const pair = priceData.pairs[0];
            const uiAmount = token.amount / Math.pow(10, token.decimals);
            const value = uiAmount * parseFloat(pair.priceUsd || 0);
            
            holdings.push({
              mint: token.mint,
              symbol: pair.baseToken?.symbol,
              amount: uiAmount,
              valueUSD: value,
              price: parseFloat(pair.priceUsd),
              priceChange24h: pair.priceChange?.h24,
            });
          }
        } catch (e) {
          // Skip failed token lookups
        }
      }

      // Sort by value
      holdings.sort((a, b) => b.valueUSD - a.valueUSD);

      const totalValue = holdings.reduce((a, h) => a + h.valueUSD, 0);

      return {
        success: true,
        walletAddress,
        solBalance: (data.nativeBalance || 0) / 1e9,
        tokenCount: data.tokens?.length || 0,
        totalValueUSD: totalValue,
        topHoldings: holdings.slice(0, 10),
        isWhale: totalValue > 100000,
        tier: totalValue > 1000000 ? 'MEGA_WHALE' : totalValue > 100000 ? 'WHALE' : totalValue > 10000 ? 'DOLPHIN' : 'FISH',
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Find whales for multiple tokens
   */
  async findWhalesMulti(tokenMints) {
    const results = await Promise.all(
      tokenMints.slice(0, 5).map(mint => this.quickHolderCheck(mint))
    );

    // Sort by concentration risk
    const riskOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    results.sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk]);

    return {
      success: true,
      analyzed: tokenMints.length,
      highRisk: results.filter(r => r.risk === 'HIGH'),
      results,
    };
  }

  /**
   * Express router
   */
  router(x402, recipientWallet) {
    const express = require('express');
    const router = express.Router();

    router.get('/whale-tracker', (req, res) => {
      res.json({
        name: this.name,
        description: this.description,
        price: this.price,
        currency: 'USDC',
        skills: this.skills,
        endpoints: {
          track: 'POST /api/agents/whale-tracker/track',
          quick: 'POST /api/agents/whale-tracker/quick',
          wallet: 'POST /api/agents/whale-tracker/wallet',
          multi: 'POST /api/agents/whale-tracker/multi',
        },
      });
    });

    router.post('/whale-tracker/track',
      x402.middleware({ price: this.price, recipient: recipientWallet }),
      async (req, res) => {
        const { tokenMint } = req.body;
        if (!tokenMint) return res.status(400).json({ error: 'tokenMint required' });
        const result = await this.trackWhales(tokenMint);
        res.json(result);
      }
    );

    router.post('/whale-tracker/quick',
      x402.middleware({ price: this.price * 0.35, recipient: recipientWallet }),
      async (req, res) => {
        const { tokenMint } = req.body;
        if (!tokenMint) return res.status(400).json({ error: 'tokenMint required' });
        const result = await this.quickHolderCheck(tokenMint);
        res.json(result);
      }
    );

    router.post('/whale-tracker/wallet',
      x402.middleware({ price: this.price * 0.8, recipient: recipientWallet }),
      async (req, res) => {
        const { walletAddress } = req.body;
        if (!walletAddress) return res.status(400).json({ error: 'walletAddress required' });
        const result = await this.trackWallet(walletAddress);
        res.json(result);
      }
    );

    router.post('/whale-tracker/multi',
      x402.middleware({ price: this.price * 1.5, recipient: recipientWallet }),
      async (req, res) => {
        const { tokenMints } = req.body;
        if (!tokenMints || !Array.isArray(tokenMints)) {
          return res.status(400).json({ error: 'tokenMints array required' });
        }
        const result = await this.findWhalesMulti(tokenMints);
        res.json(result);
      }
    );

    return router;
  }
}

module.exports = { WhaleTrackerAgent };
