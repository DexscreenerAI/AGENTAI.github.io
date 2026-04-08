class SmartContractAuditorAgent {
  constructor(config = {}) {
    this.name = 'Smart Contract Auditor';
    this.price = 1.00;
    this.apiKey = config.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  }
  async audit(code, options = {}) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 4000, messages: [{ role: 'user', content: `Security audit this smart contract:\n\n${code}\n\nCheck: reentrancy, overflow, access control, etc.\n\nJSON: {summary: {overallRisk, auditScore, recommendation}, findings: [{severity, title, description, fix}], checklist: {signerChecks, ownerChecks, arithmeticSafe}}` }] })
    });
    const data = await response.json();
    try {
      const audit = JSON.parse(data.content[0].text.match(/\{[\s\S]*\}/)[0]);
      const stats = { critical: 0, high: 0, medium: 0, low: 0, total: audit.findings?.length || 0 };
      (audit.findings || []).forEach(f => { if (f.severity) stats[f.severity.toLowerCase()]++; });
      return { success: true, audit, stats };
    } catch { return { success: true, audit: { raw: data.content[0].text }, stats: {} }; }
  }
  async quickScan(code) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, messages: [{ role: 'user', content: `Quick security scan:\n\n${code}\n\nJSON: {riskLevel, vulnerabilities: [{severity, issue}], deploymentReady}` }] })
    });
    const data = await response.json();
    try { return { success: true, ...JSON.parse(data.content[0].text.match(/\{[\s\S]*\}/)[0]) }; } catch { return { success: true, raw: data.content[0].text }; }
  }
  router(x402, wallet) {
    const express = require('express');
    const router = express.Router();
    router.get('/smart-contract-auditor', (req, res) => res.json({ name: this.name, price: this.price }));
    router.post('/smart-contract-auditor/audit', x402.middleware({ price: this.price, recipient: wallet }), async (req, res) => res.json(await this.audit(req.body.code, req.body)));
    router.post('/smart-contract-auditor/quick-scan', x402.middleware({ price: 0.40, recipient: wallet }), async (req, res) => res.json(await this.quickScan(req.body.code)));
    return router;
  }
}
module.exports = { SmartContractAuditorAgent };
