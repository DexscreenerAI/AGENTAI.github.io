/**
 * SOLANA ANALYZER AGENT
 * 
 * Comprehensive Solana token analysis:
 * - DexScreener data (price, volume, liquidity)
 * - Rugcheck.xyz risk assessment
 * - Holder analysis
 * - AI-powered verdict
 * 
 * Price: $0.50 per analysis
 */

const Anthropic = require('@anthropic-ai/sdk');

class SolanaAnalyzerAgent {
  constructor(config = {}) {
    this.name = 'Solana Analyzer';
    this.description = 'AI-powered Solana token analysis with DexScreener, Rugcheck, and risk assessment';
    this.price = config.price || 0.50;
    this.skills = ['Solana', 'DeFi', 'Token Analysis', 'Risk Assessment', 'On-chain Data'];
    
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Fetch token data from DexScreener
   */
  async fetchDexScreener(tokenMint) {
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`);
      const data = await response.json();
      
      if (!data.pairs || data.pairs.length === 0) {
        return { error: 'Token not found on DexScreener' };
      }

      // Get the main pair (highest liquidity)
      const pair = data.pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      
      return {
        name: pair.baseToken?.name,
        symbol: pair.baseToken?.symbol,
        address: pair.baseToken?.address,
        price: pair.priceUsd,
        priceChange24h: pair.priceChange?.h24,
        priceChange1h: pair.priceChange?.h1,
        volume24h: pair.volume?.h24,
        liquidity: pair.liquidity?.usd,
        fdv: pair.fdv,
        marketCap: pair.marketCap,
        pairAddress: pair.pairAddress,
        dexId: pair.dexId,
        txns24h: {
          buys: pair.txns?.h24?.buys,
          sells: pair.txns?.h24?.sells,
        },
        createdAt: pair.pairCreatedAt,
        url: pair.url,
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Fetch risk data from Rugcheck
   */
  async fetchRugcheck(tokenMint) {
    try {
      const response = await fetch(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report/summary`);
      const data = await response.json();
      
      return {
        riskScore: data.score,
        riskLevel: data.score >= 800 ? 'LOW' : data.score >= 500 ? 'MEDIUM' : 'HIGH',
        risks: data.risks || [],
        topHolders: data.topHolders?.slice(0, 10) || [],
        totalHolders: data.totalHolders,
        mintAuthority: data.mintAuthority,
        freezeAuthority: data.freezeAuthority,
        lpLocked: data.lpLocked,
        lpLockedPct: data.lpLockedPct,
      };
    } catch (error) {
      // Fallback if API fails
      return { 
        error: error.message,
        riskLevel: 'UNKNOWN',
        note: 'Could not fetch Rugcheck data'
      };
    }
  }

  /**
   * Get additional on-chain data
   */
  async fetchOnChainData(tokenMint) {
    try {
      // Fetch from Solana FM or Helius (simplified)
      const response = await fetch(`https://api.solana.fm/v1/tokens/${tokenMint}`);
      const data = await response.json();
      
      return {
        decimals: data.decimals,
        supply: data.supply,
        holders: data.holders,
      };
    } catch (error) {
      return { error: 'On-chain data unavailable' };
    }
  }

  /**
   * AI-powered analysis
   */
  async analyzeWithAI(tokenData, rugcheckData, userQuestion = null) {
    const systemPrompt = `You are an expert Solana DeFi analyst. You analyze tokens for trading opportunities and risks.

Your analysis must be:
- Data-driven (use the numbers provided)
- Balanced (show both bullish and bearish cases)
- Actionable (give clear recommendations)

Always respond in JSON format:
{
  "verdict": "BULLISH|BEARISH|NEUTRAL|AVOID",
  "confidence": 0-100,
  "summary": "1-2 sentence summary",
  "analysis": {
    "liquidity": { "score": 0-100, "note": "..." },
    "volume": { "score": 0-100, "note": "..." },
    "holders": { "score": 0-100, "note": "..." },
    "risk": { "score": 0-100, "note": "..." }
  },
  "bullishCase": ["reason1", "reason2"],
  "bearishCase": ["reason1", "reason2"],
  "redFlags": ["flag1", "flag2"],
  "recommendation": {
    "action": "BUY|SELL|HOLD|AVOID",
    "entryPrice": "suggested entry or null",
    "targetPrice": "suggested target or null",
    "stopLoss": "suggested stop loss or null",
    "positionSize": "% of portfolio suggestion"
  }
}`;

    const dataPrompt = `Analyze this Solana token:

**DexScreener Data:**
- Name: ${tokenData.name} (${tokenData.symbol})
- Price: $${tokenData.price}
- 24h Change: ${tokenData.priceChange24h}%
- 1h Change: ${tokenData.priceChange1h}%
- 24h Volume: $${tokenData.volume24h?.toLocaleString()}
- Liquidity: $${tokenData.liquidity?.toLocaleString()}
- FDV: $${tokenData.fdv?.toLocaleString()}
- Market Cap: $${tokenData.marketCap?.toLocaleString()}
- 24h Buys: ${tokenData.txns24h?.buys} | Sells: ${tokenData.txns24h?.sells}
- DEX: ${tokenData.dexId}
- Created: ${tokenData.createdAt ? new Date(tokenData.createdAt).toISOString() : 'Unknown'}

**Rugcheck Data:**
- Risk Score: ${rugcheckData.riskScore}/1000
- Risk Level: ${rugcheckData.riskLevel}
- Total Holders: ${rugcheckData.totalHolders}
- LP Locked: ${rugcheckData.lpLockedPct}%
- Mint Authority: ${rugcheckData.mintAuthority ? 'ENABLED ⚠️' : 'Disabled ✅'}
- Freeze Authority: ${rugcheckData.freezeAuthority ? 'ENABLED ⚠️' : 'Disabled ✅'}
- Risks: ${JSON.stringify(rugcheckData.risks)}

${userQuestion ? `User question: ${userQuestion}` : ''}

Provide a comprehensive analysis in JSON format.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: dataPrompt }],
        system: systemPrompt,
      });

      const content = response.content[0].text;
      
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        return { raw: content };
      }
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Full token analysis
   */
  async analyze(tokenMint, options = {}) {
    const startTime = Date.now();

    // Fetch all data in parallel
    const [dexData, rugData] = await Promise.all([
      this.fetchDexScreener(tokenMint),
      this.fetchRugcheck(tokenMint),
    ]);

    // Check if token exists
    if (dexData.error && dexData.error.includes('not found')) {
      return {
        success: false,
        error: 'Token not found. Check the mint address.',
        tokenMint,
      };
    }

    // AI Analysis
    const aiAnalysis = await this.analyzeWithAI(dexData, rugData, options.question);

    const analysisTime = Date.now() - startTime;

    return {
      success: true,
      tokenMint,
      token: {
        name: dexData.name,
        symbol: dexData.symbol,
        price: dexData.price,
        priceChange24h: dexData.priceChange24h,
      },
      dexscreener: dexData,
      rugcheck: rugData,
      analysis: aiAnalysis,
      meta: {
        analysisTime: `${analysisTime}ms`,
        timestamp: new Date().toISOString(),
        cost: this.price,
      },
      links: {
        dexscreener: `https://dexscreener.com/solana/${tokenMint}`,
        rugcheck: `https://rugcheck.xyz/tokens/${tokenMint}`,
        birdeye: `https://birdeye.so/token/${tokenMint}?chain=solana`,
        solscan: `https://solscan.io/token/${tokenMint}`,
      },
    };
  }

  /**
   * Quick risk check only (cheaper)
   */
  async quickRiskCheck(tokenMint) {
    const rugData = await this.fetchRugcheck(tokenMint);
    
    let verdict = 'UNKNOWN';
    if (rugData.riskScore >= 800) verdict = 'SAFE';
    else if (rugData.riskScore >= 500) verdict = 'CAUTION';
    else if (rugData.riskScore > 0) verdict = 'DANGER';
    
    return {
      tokenMint,
      verdict,
      riskScore: rugData.riskScore,
      riskLevel: rugData.riskLevel,
      mintAuthority: rugData.mintAuthority,
      freezeAuthority: rugData.freezeAuthority,
      lpLocked: rugData.lpLockedPct,
      risks: rugData.risks?.slice(0, 5),
    };
  }

  /**
   * Compare multiple tokens
   */
  async compare(tokenMints) {
    const analyses = await Promise.all(
      tokenMints.slice(0, 5).map(mint => this.analyze(mint))
    );

    // Rank by AI verdict confidence
    const ranked = analyses
      .filter(a => a.success)
      .sort((a, b) => (b.analysis?.confidence || 0) - (a.analysis?.confidence || 0));

    return {
      success: true,
      compared: tokenMints.length,
      ranking: ranked.map((a, i) => ({
        rank: i + 1,
        symbol: a.token?.symbol,
        verdict: a.analysis?.verdict,
        confidence: a.analysis?.confidence,
        price: a.token?.price,
        riskLevel: a.rugcheck?.riskLevel,
      })),
      fullAnalyses: ranked,
    };
  }

  /**
   * Express router
   */
  router(x402, recipientWallet) {
    const express = require('express');
    const router = express.Router();

    // Agent info
    router.get('/solana-analyzer', (req, res) => {
      res.json({
        name: this.name,
        description: this.description,
        price: this.price,
        currency: 'USDC',
        skills: this.skills,
        endpoints: {
          analyze: 'POST /api/agents/solana-analyzer/analyze',
          quickCheck: 'POST /api/agents/solana-analyzer/quick-check',
          compare: 'POST /api/agents/solana-analyzer/compare',
        },
      });
    });

    // Full analysis (paid)
    router.post('/solana-analyzer/analyze',
      x402.middleware({ price: this.price, recipient: recipientWallet }),
      async (req, res) => {
        const { tokenMint, question } = req.body;
        
        if (!tokenMint) {
          return res.status(400).json({ error: 'tokenMint is required' });
        }

        const result = await this.analyze(tokenMint, { question });
        res.json(result);
      }
    );

    // Quick risk check (cheaper)
    router.post('/solana-analyzer/quick-check',
      x402.middleware({ price: this.price * 0.4, recipient: recipientWallet }),
      async (req, res) => {
        const { tokenMint } = req.body;
        
        if (!tokenMint) {
          return res.status(400).json({ error: 'tokenMint is required' });
        }

        const result = await this.quickRiskCheck(tokenMint);
        res.json(result);
      }
    );

    // Compare tokens (more expensive)
    router.post('/solana-analyzer/compare',
      x402.middleware({ price: this.price * 2, recipient: recipientWallet }),
      async (req, res) => {
        const { tokenMints } = req.body;
        
        if (!tokenMints || !Array.isArray(tokenMints) || tokenMints.length < 2) {
          return res.status(400).json({ error: 'tokenMints array (2-5 tokens) is required' });
        }

        const result = await this.compare(tokenMints);
        res.json(result);
      }
    );

    return router;
  }
}

module.exports = { SolanaAnalyzerAgent };
