class SolanaAnalyzerAgent {
  constructor(config = {}) {
    this.name = 'Solana Analyzer';
    this.price = 0.50;
    this.apiKey = config.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  }
  async fetchDexScreener(mint) {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    const data = await res.json();
    if (!data.pairs?.length) return { error: 'Token not found' };
    const p = data.pairs[0];
    return { name: p.baseToken?.name, symbol: p.baseToken?.symbol, price: p.priceUsd, priceChange24h: p.priceChange?.h24, volume24h: p.volume?.h24, liquidity: p.liquidity?.usd, fdv: p.fdv };
  }
  async fetchRugcheck(mint) {
    try {
      const res = await fetch(`https://api.rugcheck.xyz/v1/tokens/${mint}/report/summary`);
      const data = await res.json();
      return { riskScore: data.score, riskLevel: data.score >= 800 ? 'LOW' : data.score >= 500 ? 'MEDIUM' : 'HIGH', risks: data.risks };
    } catch { return { riskLevel: 'UNKNOWN' }; }
  }
  async analyze(tokenMint, options = {}) {
    const [dex, rug] = await Promise.all([this.fetchDexScreener(tokenMint), this.fetchRugcheck(tokenMint)]);
    if (dex.error) return { success: false, error: dex.error };
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, messages: [{ role: 'user', content: `Analyze token: ${dex.name} (${dex.symbol})\nPrice: $${dex.price}, 24h: ${dex.priceChange24h}%, Vol: $${dex.volume24h}, Liq: $${dex.liquidity}\nRisk: ${rug.riskLevel} (${rug.riskScore}/1000)\n\nJSON: {verdict: BULLISH/BEARISH/NEUTRAL, confidence: 0-100, summary, recommendation: {action, positionSize}}` }] })
    });
    const data = await response.json();
    try { return { success: true, token: dex, rugcheck: rug, analysis: JSON.parse(data.content[0].text.match(/\{[\s\S]*\}/)[0]) }; } catch { return { success: true, token: dex, rugcheck: rug, analysis: { raw: data.content[0].text } }; }
  }
  router(x402, wallet) {
    const express = require('express');
    const router = express.Router();
    router.get('/solana-analyzer', (req, res) => res.json({ name: this.name, price: this.price }));
    router.post('/solana-analyzer/analyze', x402.middleware({ price: this.price, recipient: wallet }), async (req, res) => {
      const result = await this.analyze(req.body.tokenMint, req.body);
      res.json(result);
    });
    router.post('/solana-analyzer/quick-check', x402.middleware({ price: 0.20, recipient: wallet }), async (req, res) => {
      const rug = await this.fetchRugcheck(req.body.tokenMint);
      res.json({ success: true, ...rug });
    });
    return router;
  }
}
module.exports = { SolanaAnalyzerAgent };
