/**
 * EXIT SIGNAL AGENT
 * 
 * AI-powered sell signal analysis:
 * - Technical indicators (RSI, MACD, etc.)
 * - Volume analysis
 * - Holder behavior
 * - Whale movements
 * - AI recommendation
 * 
 * Price: $0.35 per signal
 */

const Anthropic = require('@anthropic-ai/sdk');

class ExitSignalAgent {
  constructor(config = {}) {
    this.name = 'Exit Signal';
    this.description = 'AI-powered exit timing for Solana tokens with technical analysis and whale tracking';
    this.price = config.price || 0.35;
    this.skills = ['Technical Analysis', 'Exit Timing', 'Risk Management', 'Whale Tracking'];
    
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Fetch token data from DexScreener
   */
  async fetchTokenData(tokenMint) {
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`);
      const data = await response.json();
      
      if (!data.pairs || data.pairs.length === 0) {
        return { error: 'Token not found' };
      }

      const pair = data.pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      
      return {
        symbol: pair.baseToken?.symbol,
        name: pair.baseToken?.name,
        price: parseFloat(pair.priceUsd),
        priceChange: {
          m5: pair.priceChange?.m5,
          h1: pair.priceChange?.h1,
          h6: pair.priceChange?.h6,
          h24: pair.priceChange?.h24,
        },
        volume: {
          h1: pair.volume?.h1,
          h6: pair.volume?.h6,
          h24: pair.volume?.h24,
        },
        txns: {
          h1: pair.txns?.h1,
          h24: pair.txns?.h24,
        },
        liquidity: pair.liquidity?.usd,
        fdv: pair.fdv,
        marketCap: pair.marketCap,
        pairAddress: pair.pairAddress,
        dexId: pair.dexId,
        priceUsd: pair.priceUsd,
        ath: pair.priceUsd, // Would need historical data for real ATH
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Fetch Rugcheck risk data
   */
  async fetchRiskData(tokenMint) {
    try {
      const response = await fetch(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report/summary`);
      const data = await response.json();
      
      return {
        riskScore: data.score,
        risks: data.risks || [],
        topHolders: data.topHolders?.slice(0, 5) || [],
        mintAuthority: data.mintAuthority,
        freezeAuthority: data.freezeAuthority,
      };
    } catch (error) {
      return { riskScore: 0, risks: [] };
    }
  }

  /**
   * Calculate technical indicators
   */
  calculateIndicators(tokenData) {
    // Simplified indicators based on available data
    const { priceChange, volume, txns, liquidity } = tokenData;
    
    // Buy/Sell pressure
    const buyPressure = txns?.h24?.buys || 0;
    const sellPressure = txns?.h24?.sells || 0;
    const buySellRatio = sellPressure > 0 ? buyPressure / sellPressure : buyPressure > 0 ? 2 : 1;
    
    // Volume trend
    const volumeTrend = volume?.h1 && volume?.h6 
      ? (volume.h1 * 6) / volume.h6 
      : 1;
    
    // Price momentum
    const momentum = {
      shortTerm: priceChange?.h1 || 0,
      mediumTerm: priceChange?.h6 || 0,
      longTerm: priceChange?.h24 || 0,
    };
    
    // Simplified RSI-like indicator (0-100)
    let pseudoRSI = 50;
    if (priceChange?.h24 > 50) pseudoRSI = 80;
    else if (priceChange?.h24 > 20) pseudoRSI = 65;
    else if (priceChange?.h24 < -20) pseudoRSI = 35;
    else if (priceChange?.h24 < -50) pseudoRSI = 20;
    else pseudoRSI = 50 + (priceChange?.h24 || 0) / 2;
    
    // Liquidity health
    const liquidityRatio = liquidity && tokenData.marketCap 
      ? liquidity / tokenData.marketCap 
      : 0;
    
    return {
      buySellRatio: buySellRatio.toFixed(2),
      buySellSignal: buySellRatio > 1.2 ? 'BULLISH' : buySellRatio < 0.8 ? 'BEARISH' : 'NEUTRAL',
      volumeTrend: volumeTrend.toFixed(2),
      volumeSignal: volumeTrend > 1.5 ? 'INCREASING' : volumeTrend < 0.5 ? 'DECREASING' : 'STABLE',
      momentum,
      momentumSignal: momentum.shortTerm > momentum.mediumTerm ? 'ACCELERATING' : 'DECELERATING',
      pseudoRSI: Math.round(pseudoRSI),
      rsiSignal: pseudoRSI > 70 ? 'OVERBOUGHT' : pseudoRSI < 30 ? 'OVERSOLD' : 'NEUTRAL',
      liquidityRatio: (liquidityRatio * 100).toFixed(2) + '%',
      liquiditySignal: liquidityRatio > 0.1 ? 'HEALTHY' : liquidityRatio > 0.05 ? 'MODERATE' : 'LOW',
    };
  }

  /**
   * AI-powered exit analysis
   */
  async analyzeWithAI(tokenData, riskData, indicators, userPosition = null) {
    const systemPrompt = `You are an expert crypto trading analyst specializing in exit timing.
Your job is to help traders decide WHEN to sell their tokens.

Be direct and actionable. Traders need clear signals, not vague advice.

Respond in JSON:
{
  "signal": "SELL_NOW|SELL_PARTIAL|HOLD|HOLD_TIGHT|ACCUMULATE",
  "urgency": "immediate|soon|no_rush|wait",
  "confidence": 0-100,
  "summary": "One sentence summary",
  "reasoning": {
    "technical": "Technical analysis reasoning",
    "fundamental": "Fundamental/risk reasoning",
    "sentiment": "Market sentiment reasoning"
  },
  "exitStrategy": {
    "recommendation": "What to do",
    "targetPrice": "Target sell price or null",
    "stopLoss": "Stop loss price or null",
    "sellPercentage": "% to sell now (0-100)"
  },
  "keyLevels": {
    "support": ["support level 1", "support level 2"],
    "resistance": ["resistance level 1", "resistance level 2"]
  },
  "warnings": ["Warning 1", "Warning 2"],
  "timeHorizon": "How long this analysis is valid"
}`;

    const userPrompt = `Analyze exit timing for this token:

**Token:** ${tokenData.symbol} (${tokenData.name})
**Current Price:** $${tokenData.price}
**Market Cap:** $${tokenData.marketCap?.toLocaleString()}
**Liquidity:** $${tokenData.liquidity?.toLocaleString()}

**Price Changes:**
- 5min: ${tokenData.priceChange?.m5}%
- 1h: ${tokenData.priceChange?.h1}%
- 6h: ${tokenData.priceChange?.h6}%
- 24h: ${tokenData.priceChange?.h24}%

**Volume 24h:** $${tokenData.volume?.h24?.toLocaleString()}
**Buys/Sells 24h:** ${tokenData.txns?.h24?.buys} / ${tokenData.txns?.h24?.sells}

**Technical Indicators:**
- Buy/Sell Ratio: ${indicators.buySellRatio} (${indicators.buySellSignal})
- Volume Trend: ${indicators.volumeTrend}x (${indicators.volumeSignal})
- Pseudo-RSI: ${indicators.pseudoRSI} (${indicators.rsiSignal})
- Momentum: ${indicators.momentumSignal}
- Liquidity Health: ${indicators.liquidityRatio} (${indicators.liquiditySignal})

**Risk Data:**
- Risk Score: ${riskData.riskScore}/1000
- Mint Authority: ${riskData.mintAuthority ? '⚠️ ENABLED' : '✅ Disabled'}
- Freeze Authority: ${riskData.freezeAuthority ? '⚠️ ENABLED' : '✅ Disabled'}
- Top 5 Holders Control: ${riskData.topHolders?.reduce((a, h) => a + (h.pct || 0), 0)?.toFixed(1)}%

${userPosition ? `**User Position:**
- Entry Price: $${userPosition.entryPrice}
- Amount Held: ${userPosition.amount}
- Current PnL: ${((tokenData.price / userPosition.entryPrice - 1) * 100).toFixed(2)}%` : ''}

Provide exit signal analysis in JSON format.`;

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
   * Full exit signal analysis
   */
  async analyze(tokenMint, options = {}) {
    const startTime = Date.now();

    // Fetch all data
    const [tokenData, riskData] = await Promise.all([
      this.fetchTokenData(tokenMint),
      this.fetchRiskData(tokenMint),
    ]);

    if (tokenData.error) {
      return { success: false, error: tokenData.error };
    }

    // Calculate indicators
    const indicators = this.calculateIndicators(tokenData);

    // AI Analysis
    const aiAnalysis = await this.analyzeWithAI(tokenData, riskData, indicators, options.position);

    const analysisTime = Date.now() - startTime;

    return {
      success: true,
      tokenMint,
      token: {
        symbol: tokenData.symbol,
        name: tokenData.name,
        price: tokenData.price,
        priceChange24h: tokenData.priceChange?.h24,
        marketCap: tokenData.marketCap,
        liquidity: tokenData.liquidity,
      },
      indicators,
      riskData: {
        score: riskData.riskScore,
        level: riskData.riskScore >= 800 ? 'LOW' : riskData.riskScore >= 500 ? 'MEDIUM' : 'HIGH',
      },
      signal: aiAnalysis,
      meta: {
        analysisTime: `${analysisTime}ms`,
        timestamp: new Date().toISOString(),
        cost: this.price,
      },
      links: {
        dexscreener: `https://dexscreener.com/solana/${tokenMint}`,
        birdeye: `https://birdeye.so/token/${tokenMint}?chain=solana`,
      },
    };
  }

  /**
   * Quick signal (faster, less detailed)
   */
  async quickSignal(tokenMint) {
    const tokenData = await this.fetchTokenData(tokenMint);
    
    if (tokenData.error) {
      return { success: false, error: tokenData.error };
    }

    const indicators = this.calculateIndicators(tokenData);
    
    // Quick decision logic
    let signal = 'HOLD';
    let urgency = 'no_rush';
    
    // Overbought + declining volume = SELL
    if (indicators.pseudoRSI > 75 && indicators.volumeSignal === 'DECREASING') {
      signal = 'SELL_NOW';
      urgency = 'immediate';
    }
    // Strong sell pressure
    else if (parseFloat(indicators.buySellRatio) < 0.6) {
      signal = 'SELL_PARTIAL';
      urgency = 'soon';
    }
    // Oversold + increasing volume = HOLD
    else if (indicators.pseudoRSI < 30 && indicators.volumeSignal === 'INCREASING') {
      signal = 'HOLD_TIGHT';
      urgency = 'wait';
    }
    // Low liquidity warning
    else if (indicators.liquiditySignal === 'LOW') {
      signal = 'SELL_PARTIAL';
      urgency = 'soon';
    }

    return {
      success: true,
      symbol: tokenData.symbol,
      price: tokenData.price,
      signal,
      urgency,
      indicators: {
        rsi: indicators.pseudoRSI,
        buySellRatio: indicators.buySellRatio,
        volumeTrend: indicators.volumeTrend,
      },
      priceChange24h: tokenData.priceChange?.h24,
    };
  }

  /**
   * Monitor multiple tokens
   */
  async monitorTokens(tokenMints) {
    const signals = await Promise.all(
      tokenMints.slice(0, 10).map(mint => this.quickSignal(mint))
    );

    // Sort by urgency
    const urgencyOrder = { immediate: 0, soon: 1, no_rush: 2, wait: 3 };
    const sorted = signals
      .filter(s => s.success)
      .sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    return {
      success: true,
      monitored: tokenMints.length,
      alerts: sorted.filter(s => s.urgency === 'immediate' || s.urgency === 'soon'),
      all: sorted,
    };
  }

  /**
   * Express router
   */
  router(x402, recipientWallet) {
    const express = require('express');
    const router = express.Router();

    router.get('/exit-signal', (req, res) => {
      res.json({
        name: this.name,
        description: this.description,
        price: this.price,
        currency: 'USDC',
        skills: this.skills,
        endpoints: {
          analyze: 'POST /api/agents/exit-signal/analyze',
          quick: 'POST /api/agents/exit-signal/quick',
          monitor: 'POST /api/agents/exit-signal/monitor',
        },
      });
    });

    router.post('/exit-signal/analyze',
      x402.middleware({ price: this.price, recipient: recipientWallet }),
      async (req, res) => {
        const { tokenMint, position } = req.body;
        if (!tokenMint) return res.status(400).json({ error: 'tokenMint required' });
        const result = await this.analyze(tokenMint, { position });
        res.json(result);
      }
    );

    router.post('/exit-signal/quick',
      x402.middleware({ price: this.price * 0.4, recipient: recipientWallet }),
      async (req, res) => {
        const { tokenMint } = req.body;
        if (!tokenMint) return res.status(400).json({ error: 'tokenMint required' });
        const result = await this.quickSignal(tokenMint);
        res.json(result);
      }
    );

    router.post('/exit-signal/monitor',
      x402.middleware({ price: this.price * 2, recipient: recipientWallet }),
      async (req, res) => {
        const { tokenMints } = req.body;
        if (!tokenMints || !Array.isArray(tokenMints)) {
          return res.status(400).json({ error: 'tokenMints array required' });
        }
        const result = await this.monitorTokens(tokenMints);
        res.json(result);
      }
    );

    return router;
  }
}

module.exports = { ExitSignalAgent };
