class CodeReviewerAgent {
  constructor(config = {}) {
    this.name = 'Code Reviewer';
    this.price = 0.25;
    this.apiKey = config.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  }
  async review(code, options = {}) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 4000, messages: [{ role: 'user', content: `Review this code for security, performance, best practices:\n\n${code}\n\nRespond as JSON with: {summary, score, issues: [{severity, issue, fix}]}` }] })
    });
    const data = await response.json();
    try { return { success: true, review: JSON.parse(data.content[0].text.match(/\{[\s\S]*\}/)[0]) }; } catch { return { success: true, review: { raw: data.content[0].text } }; }
  }
  router(x402, wallet) {
    const express = require('express');
    const router = express.Router();
    router.get('/code-reviewer', (req, res) => res.json({ name: this.name, price: this.price }));
    router.post('/code-reviewer/review', x402.middleware({ price: this.price, recipient: wallet }), async (req, res) => {
      const result = await this.review(req.body.code, req.body);
      res.json(result);
    });
    router.post('/code-reviewer/security', x402.middleware({ price: 0.15, recipient: wallet }), async (req, res) => {
      const result = await this.review(req.body.code, { focus: 'security' });
      res.json(result);
    });
    return router;
  }
}
module.exports = { CodeReviewerAgent };
