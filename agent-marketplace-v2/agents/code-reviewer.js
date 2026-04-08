/**
 * CODE REVIEWER AGENT
 * 
 * Reviews code and provides detailed feedback:
 * - Security vulnerabilities
 * - Performance issues
 * - Best practices
 * - Suggested improvements
 * 
 * Price: $0.25 per review
 */

const Anthropic = require('@anthropic-ai/sdk');

class CodeReviewerAgent {
  constructor(config = {}) {
    this.name = 'Code Reviewer';
    this.description = 'AI-powered code review with security, performance, and best practices analysis';
    this.price = config.price || 0.25;
    this.skills = ['JavaScript', 'TypeScript', 'Python', 'Rust', 'Solidity', 'Go', 'React', 'Node.js'];
    
    // Initialize Anthropic client
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Review code and return detailed analysis
   */
  async review(code, options = {}) {
    const language = options.language || this.detectLanguage(code);
    const focusAreas = options.focusAreas || ['security', 'performance', 'best-practices', 'readability'];
    
    const systemPrompt = `You are an expert code reviewer with 15+ years of experience. 
You specialize in ${language} and provide thorough, actionable code reviews.

Your review must include:
1. **Security Issues** - Vulnerabilities, injection risks, auth problems
2. **Performance** - Inefficiencies, memory leaks, optimization opportunities  
3. **Best Practices** - Design patterns, naming conventions, code organization
4. **Readability** - Comments, structure, maintainability
5. **Bugs** - Logic errors, edge cases, potential runtime issues

Format your response as JSON:
{
  "summary": "Brief overall assessment",
  "score": 0-100,
  "issues": [
    {
      "severity": "critical|high|medium|low",
      "category": "security|performance|best-practice|bug|readability",
      "line": "line number or range",
      "issue": "Description of the issue",
      "suggestion": "How to fix it",
      "code": "Suggested code fix if applicable"
    }
  ],
  "positives": ["Good things about the code"],
  "refactoredCode": "Complete refactored version if needed"
}`;

    const userPrompt = `Review this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Focus areas: ${focusAreas.join(', ')}
${options.context ? `Context: ${options.context}` : ''}

Provide a thorough review in JSON format.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [
          { role: 'user', content: userPrompt }
        ],
        system: systemPrompt,
      });

      const content = response.content[0].text;
      
      // Parse JSON response
      let review;
      try {
        // Extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        review = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: content };
      } catch (e) {
        review = { raw: content, parseError: true };
      }

      return {
        success: true,
        language,
        review,
        tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens,
        cost: this.price,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Detect programming language from code
   */
  detectLanguage(code) {
    if (code.includes('import React') || code.includes('useState')) return 'jsx';
    if (code.includes('async fn') || code.includes('pub struct') || code.includes('impl ')) return 'rust';
    if (code.includes('pragma solidity') || code.includes('contract ')) return 'solidity';
    if (code.includes('def ') && code.includes(':')) return 'python';
    if (code.includes('func ') && code.includes('package ')) return 'go';
    if (code.includes('interface ') || code.includes(': string') || code.includes(': number')) return 'typescript';
    if (code.includes('const ') || code.includes('function ') || code.includes('=>')) return 'javascript';
    return 'unknown';
  }

  /**
   * Quick security scan only
   */
  async securityScan(code, language = 'auto') {
    const detectedLang = language === 'auto' ? this.detectLanguage(code) : language;
    
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Security scan this ${detectedLang} code. List ONLY security vulnerabilities.

\`\`\`${detectedLang}
${code}
\`\`\`

Response format JSON:
{
  "vulnerabilities": [
    { "severity": "critical|high|medium|low", "issue": "...", "fix": "..." }
  ],
  "securityScore": 0-100,
  "recommendation": "..."
}`
      }],
    });

    try {
      const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      return { raw: response.content[0].text };
    }
  }

  /**
   * Express router for this agent
   */
  router(x402, recipientWallet) {
    const express = require('express');
    const router = express.Router();

    // Agent info
    router.get('/code-reviewer', (req, res) => {
      res.json({
        name: this.name,
        description: this.description,
        price: this.price,
        currency: 'USDC',
        skills: this.skills,
        endpoints: {
          review: 'POST /api/agents/code-reviewer/review',
          security: 'POST /api/agents/code-reviewer/security',
        },
      });
    });

    // Full code review (paid)
    router.post('/code-reviewer/review',
      x402.middleware({ price: this.price, recipient: recipientWallet }),
      async (req, res) => {
        const { code, language, focusAreas, context } = req.body;
        
        if (!code) {
          return res.status(400).json({ error: 'Code is required' });
        }

        const result = await this.review(code, { language, focusAreas, context });
        res.json(result);
      }
    );

    // Quick security scan (paid - lower price)
    router.post('/code-reviewer/security',
      x402.middleware({ price: this.price * 0.6, recipient: recipientWallet }),
      async (req, res) => {
        const { code, language } = req.body;
        
        if (!code) {
          return res.status(400).json({ error: 'Code is required' });
        }

        const result = await this.securityScan(code, language);
        res.json(result);
      }
    );

    return router;
  }
}

module.exports = { CodeReviewerAgent };
