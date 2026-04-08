/**
 * CONTENT WRITER AGENT
 * 
 * AI-powered content generation:
 * - Blog posts / Articles
 * - Social media (Twitter, LinkedIn, TikTok scripts)
 * - Marketing copy
 * - Technical documentation
 * - SEO-optimized content
 * 
 * Price: $0.20 per generation
 */

const Anthropic = require('@anthropic-ai/sdk');

class ContentWriterAgent {
  constructor(config = {}) {
    this.name = 'Content Writer';
    this.description = 'AI-powered content generation for blogs, social media, marketing, and technical docs';
    this.price = config.price || 0.20;
    this.skills = ['Blog Writing', 'Social Media', 'SEO', 'Copywriting', 'Technical Writing', 'Scripts'];
    
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    });

    // Content templates
    this.templates = {
      twitter: {
        maxLength: 280,
        style: 'Concise, punchy, with hooks. Use emojis sparingly. Include hashtags.',
      },
      linkedin: {
        maxLength: 3000,
        style: 'Professional but engaging. Start with a hook. Use line breaks. End with CTA.',
      },
      tiktok: {
        maxLength: 500,
        style: 'Script format. Hook in first 3 seconds. Casual tone. Include [VISUAL] cues.',
      },
      blog: {
        maxLength: 10000,
        style: 'SEO-optimized. Clear structure with H2/H3. Engaging intro. Actionable takeaways.',
      },
      email: {
        maxLength: 2000,
        style: 'Compelling subject line. Personal tone. Clear CTA. Mobile-friendly.',
      },
      ad: {
        maxLength: 500,
        style: 'Benefit-focused. Urgency/scarcity. Strong CTA. A/B test variants.',
      },
    };
  }

  /**
   * Generate content
   */
  async generate(options) {
    const {
      type = 'blog',
      topic,
      tone = 'professional',
      audience = 'general',
      keywords = [],
      length = 'medium',
      language = 'en',
      additionalContext = '',
    } = options;

    const template = this.templates[type] || this.templates.blog;

    const lengthGuide = {
      short: 'Keep it brief, under 200 words',
      medium: 'Standard length, 300-600 words',
      long: 'Comprehensive, 800-1500 words',
      thread: 'Create a thread of 5-10 posts',
    };

    const systemPrompt = `You are an expert content writer specializing in ${type} content.

Your writing style:
- Tone: ${tone}
- Target audience: ${audience}
- Platform requirements: ${template.style}
- Length: ${lengthGuide[length] || lengthGuide.medium}
${language !== 'en' ? `- Write in ${language}` : ''}

Guidelines:
- Create engaging, original content
- Use proven copywriting frameworks (AIDA, PAS, etc.)
- Optimize for the specific platform
- Include hooks and CTAs where appropriate
- Make it shareable and memorable`;

    const userPrompt = `Create ${type} content about: ${topic}

${keywords.length > 0 ? `Keywords to include: ${keywords.join(', ')}` : ''}
${additionalContext ? `Additional context: ${additionalContext}` : ''}

Respond in JSON format:
{
  "content": "The main content here",
  "headline": "Catchy headline/title if applicable",
  "hook": "Opening hook or first line",
  "hashtags": ["relevant", "hashtags"] // for social media
  "meta": {
    "description": "SEO meta description if blog/article",
    "readTime": "Estimated read time"
  },
  "variants": ["Alternative version 1", "Alternative version 2"] // for A/B testing
}`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: userPrompt }],
        system: systemPrompt,
      });

      const content = response.content[0].text;
      
      let result;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        result = JSON.parse(jsonMatch[0]);
      } catch (e) {
        result = { content, parseError: true };
      }

      return {
        success: true,
        type,
        topic,
        result,
        meta: {
          tone,
          audience,
          language,
          tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens,
        },
        cost: this.price,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate Twitter thread
   */
  async generateThread(topic, options = {}) {
    const { tweets = 7, tone = 'engaging', audience = 'general' } = options;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `Create a Twitter thread (${tweets} tweets) about: ${topic}

Rules:
- First tweet must hook instantly
- Each tweet should flow to the next
- Mix insights, examples, and actionable tips
- Last tweet should have a CTA
- Include emojis strategically
- Keep each tweet under 280 characters

Tone: ${tone}
Audience: ${audience}

Format as JSON:
{
  "thread": [
    { "number": 1, "content": "...", "hasMedia": false },
    ...
  ],
  "suggestedMedia": ["description of images/videos to add"]
}`
      }],
    });

    try {
      const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
      return { success: true, ...JSON.parse(jsonMatch[0]) };
    } catch (e) {
      return { success: true, raw: response.content[0].text };
    }
  }

  /**
   * Generate TikTok script
   */
  async generateTikTokScript(topic, options = {}) {
    const { duration = 60, style = 'educational', hook = 'question' } = options;

    const hookStyles = {
      question: 'Start with a provocative question',
      shock: 'Start with a shocking statement',
      story: 'Start with "Let me tell you..."',
      myth: 'Start with "Everyone thinks X but actually..."',
      promise: 'Start with what they\'ll learn',
    };

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Create a ${duration}-second TikTok script about: ${topic}

Hook style: ${hookStyles[hook] || hookStyles.question}
Content style: ${style}

Format:
{
  "hook": "First 3 seconds - must stop the scroll",
  "script": [
    { "timestamp": "0:00-0:03", "text": "...", "visual": "[What to show]" },
    { "timestamp": "0:03-0:10", "text": "...", "visual": "[What to show]" },
    ...
  ],
  "cta": "End call to action",
  "sounds": "Suggested trending sounds or music",
  "hashtags": ["relevant", "hashtags"],
  "captionIdeas": ["Possible captions for the video"]
}`
      }],
    });

    try {
      const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
      return { success: true, ...JSON.parse(jsonMatch[0]) };
    } catch (e) {
      return { success: true, raw: response.content[0].text };
    }
  }

  /**
   * Rewrite/improve existing content
   */
  async rewrite(content, options = {}) {
    const { goal = 'improve', targetPlatform = 'general', tone = 'same' } = options;

    const goals = {
      improve: 'Make it more engaging and polished',
      shorten: 'Make it more concise while keeping key points',
      expand: 'Add more detail and depth',
      simplify: 'Make it easier to understand',
      seo: 'Optimize for search engines',
      convert: 'Make it more persuasive/sales-focused',
    };

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `Rewrite this content.

Original:
"""
${content}
"""

Goal: ${goals[goal] || goals.improve}
Target platform: ${targetPlatform}
${tone !== 'same' ? `New tone: ${tone}` : 'Keep similar tone'}

Respond in JSON:
{
  "rewritten": "The improved content",
  "changes": ["List of changes made"],
  "improvement": "Brief explanation of why it's better"
}`
      }],
    });

    try {
      const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
      return { success: true, ...JSON.parse(jsonMatch[0]) };
    } catch (e) {
      return { success: true, raw: response.content[0].text };
    }
  }

  /**
   * Generate content calendar
   */
  async generateCalendar(niche, options = {}) {
    const { days = 7, platforms = ['twitter', 'linkedin'], postsPerDay = 1 } = options;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Create a ${days}-day content calendar for: ${niche}

Platforms: ${platforms.join(', ')}
Posts per day: ${postsPerDay}

For each day, provide:
{
  "calendar": [
    {
      "day": 1,
      "date": "Day 1",
      "theme": "Daily theme",
      "posts": [
        {
          "platform": "twitter",
          "time": "9:00 AM",
          "type": "thread|single|poll|etc",
          "topic": "What to post about",
          "hook": "Opening line",
          "content": "Full content or outline"
        }
      ]
    }
  ],
  "tips": ["Content strategy tips for this niche"]
}`
      }],
    });

    try {
      const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
      return { success: true, ...JSON.parse(jsonMatch[0]) };
    } catch (e) {
      return { success: true, raw: response.content[0].text };
    }
  }

  /**
   * Express router
   */
  router(x402, recipientWallet) {
    const express = require('express');
    const router = express.Router();

    // Agent info
    router.get('/content-writer', (req, res) => {
      res.json({
        name: this.name,
        description: this.description,
        price: this.price,
        currency: 'USDC',
        skills: this.skills,
        supportedTypes: Object.keys(this.templates),
        endpoints: {
          generate: 'POST /api/agents/content-writer/generate',
          thread: 'POST /api/agents/content-writer/thread',
          tiktok: 'POST /api/agents/content-writer/tiktok',
          rewrite: 'POST /api/agents/content-writer/rewrite',
          calendar: 'POST /api/agents/content-writer/calendar',
        },
      });
    });

    // Generate content (paid)
    router.post('/content-writer/generate',
      x402.middleware({ price: this.price, recipient: recipientWallet }),
      async (req, res) => {
        const result = await this.generate(req.body);
        res.json(result);
      }
    );

    // Twitter thread (paid)
    router.post('/content-writer/thread',
      x402.middleware({ price: this.price * 1.5, recipient: recipientWallet }),
      async (req, res) => {
        const { topic, ...options } = req.body;
        if (!topic) return res.status(400).json({ error: 'topic required' });
        const result = await this.generateThread(topic, options);
        res.json(result);
      }
    );

    // TikTok script (paid)
    router.post('/content-writer/tiktok',
      x402.middleware({ price: this.price * 1.2, recipient: recipientWallet }),
      async (req, res) => {
        const { topic, ...options } = req.body;
        if (!topic) return res.status(400).json({ error: 'topic required' });
        const result = await this.generateTikTokScript(topic, options);
        res.json(result);
      }
    );

    // Rewrite content (paid)
    router.post('/content-writer/rewrite',
      x402.middleware({ price: this.price, recipient: recipientWallet }),
      async (req, res) => {
        const { content, ...options } = req.body;
        if (!content) return res.status(400).json({ error: 'content required' });
        const result = await this.rewrite(content, options);
        res.json(result);
      }
    );

    // Content calendar (more expensive)
    router.post('/content-writer/calendar',
      x402.middleware({ price: this.price * 3, recipient: recipientWallet }),
      async (req, res) => {
        const { niche, ...options } = req.body;
        if (!niche) return res.status(400).json({ error: 'niche required' });
        const result = await this.generateCalendar(niche, options);
        res.json(result);
      }
    );

    return router;
  }
}

module.exports = { ContentWriterAgent };
