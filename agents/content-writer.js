class ContentWriterAgent {
  constructor(config = {}) {
    this.name = 'Content Writer';
    this.price = 0.20;
    this.apiKey = config.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  }
  async generate(options) {
    const { type = 'twitter', topic, tone = 'professional' } = options;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, messages: [{ role: 'user', content: `Create ${type} content about: ${topic}\nTone: ${tone}\n\nJSON: {content, headline, hashtags: []}` }] })
    });
    const data = await response.json();
    try { return { success: true, result: JSON.parse(data.content[0].text.match(/\{[\s\S]*\}/)[0]) }; } catch { return { success: true, result: { content: data.content[0].text } }; }
  }
  async thread(topic, options = {}) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, messages: [{ role: 'user', content: `Create Twitter thread (7 tweets) about: ${topic}\n\nJSON: {thread: [{number, content}]}` }] })
    });
    const data = await response.json();
    try { return { success: true, ...JSON.parse(data.content[0].text.match(/\{[\s\S]*\}/)[0]) }; } catch { return { success: true, raw: data.content[0].text }; }
  }
  async tiktok(topic, options = {}) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, messages: [{ role: 'user', content: `Create 60s TikTok script about: ${topic}\n\nJSON: {hook, script: [{timestamp, text, visual}], cta, hashtags}` }] })
    });
    const data = await response.json();
    try { return { success: true, ...JSON.parse(data.content[0].text.match(/\{[\s\S]*\}/)[0]) }; } catch { return { success: true, raw: data.content[0].text }; }
  }
  router(x402, wallet) {
    const express = require('express');
    const router = express.Router();
    router.get('/content-writer', (req, res) => res.json({ name: this.name, price: this.price }));
    router.post('/content-writer/generate', x402.middleware({ price: this.price, recipient: wallet }), async (req, res) => res.json(await this.generate(req.body)));
    router.post('/content-writer/thread', x402.middleware({ price: 0.30, recipient: wallet }), async (req, res) => res.json(await this.thread(req.body.topic, req.body)));
    router.post('/content-writer/tiktok', x402.middleware({ price: 0.24, recipient: wallet }), async (req, res) => res.json(await this.tiktok(req.body.topic, req.body)));
    return router;
  }
}
module.exports = { ContentWriterAgent };
