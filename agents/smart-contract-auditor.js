/**
 * SMART CONTRACT AUDITOR AGENT
 * 
 * Security audit for smart contracts:
 * - Solana (Anchor/Rust)
 * - Ethereum (Solidity)
 * - Vulnerability detection
 * - Best practices review
 * - Gas optimization (for EVM)
 * 
 * Price: $1.00 per audit
 */

const Anthropic = require('@anthropic-ai/sdk');

class SmartContractAuditorAgent {
  constructor(config = {}) {
    this.name = 'Smart Contract Auditor';
    this.description = 'AI-powered smart contract security audit for Solana (Anchor/Rust) and Ethereum (Solidity)';
    this.price = config.price || 1.00;
    this.skills = ['Solana', 'Anchor', 'Rust', 'Solidity', 'Security Audit', 'DeFi'];
    
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    });

    // Known vulnerability patterns
    this.vulnerabilityPatterns = {
      solana: [
        'Missing signer check',
        'Missing owner check',
        'Integer overflow/underflow',
        'Arbitrary CPI',
        'Account confusion',
        'Bump seed canonicalization',
        'PDA sharing',
        'Closing accounts',
        'Reinitialization',
        'Type cosplay',
        'Missing rent exemption check',
        'Unsafe arithmetic',
      ],
      solidity: [
        'Reentrancy',
        'Integer overflow/underflow',
        'Access control',
        'Unchecked return values',
        'Front-running',
        'Timestamp dependence',
        'Denial of service',
        'Oracle manipulation',
        'Flash loan attacks',
        'Delegatecall injection',
        'Signature malleability',
        'Gas griefing',
      ],
    };
  }

  /**
   * Detect contract type
   */
  detectContractType(code) {
    if (code.includes('use anchor_lang') || code.includes('declare_id!') || code.includes('#[program]')) {
      return 'solana-anchor';
    }
    if (code.includes('pub fn') && code.includes('impl') && code.includes('Result<')) {
      return 'solana-native';
    }
    if (code.includes('pragma solidity') || code.includes('contract ')) {
      return 'solidity';
    }
    return 'unknown';
  }

  /**
   * Full security audit
   */
  async audit(code, options = {}) {
    const contractType = options.contractType || this.detectContractType(code);
    const vulnerabilities = this.vulnerabilityPatterns[contractType.includes('solana') ? 'solana' : 'solidity'] || [];

    const systemPrompt = `You are a senior smart contract security auditor with 10+ years of experience.
You have audited billions of dollars in TVL across DeFi protocols.

Contract type: ${contractType}

Your audit must check for:
${vulnerabilities.map((v, i) => `${i + 1}. ${v}`).join('\n')}

Severity levels:
- CRITICAL: Can lead to loss of funds or complete contract takeover
- HIGH: Significant impact, should be fixed before deployment
- MEDIUM: Important issues that should be addressed
- LOW: Best practice improvements
- INFORMATIONAL: Suggestions for better code quality

Format your response as JSON:
{
  "summary": {
    "contractType": "${contractType}",
    "overallRisk": "CRITICAL|HIGH|MEDIUM|LOW|SAFE",
    "auditScore": 0-100,
    "recommendation": "DEPLOY|FIX_CRITICAL|FIX_HIGH|REVIEW"
  },
  "findings": [
    {
      "id": "F-001",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
      "title": "Issue title",
      "location": "Function or line reference",
      "description": "Detailed description of the issue",
      "impact": "What could happen if exploited",
      "recommendation": "How to fix it",
      "fixedCode": "Code snippet showing the fix"
    }
  ],
  "gasOptimizations": [
    {
      "location": "...",
      "current": "Current gas cost or pattern",
      "optimized": "Suggested optimization",
      "savings": "Estimated savings"
    }
  ],
  "bestPractices": [
    {
      "category": "Security|Code Quality|Documentation",
      "suggestion": "..."
    }
  ],
  "checklist": {
    "signerChecks": true/false,
    "ownerChecks": true/false,
    "arithmeticSafe": true/false,
    "reentrancyProtected": true/false,
    "accessControlled": true/false,
    "eventsEmitted": true/false,
    "errorHandling": true/false
  }
}`;

    const userPrompt = `Audit this ${contractType} smart contract:

\`\`\`${contractType.includes('solana') ? 'rust' : 'solidity'}
${code}
\`\`\`

${options.context ? `Additional context: ${options.context}` : ''}
${options.focusAreas ? `Focus areas: ${options.focusAreas.join(', ')}` : ''}

Provide a comprehensive security audit in JSON format.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 6000,
        messages: [{ role: 'user', content: userPrompt }],
        system: systemPrompt,
      });

      const content = response.content[0].text;
      
      let audit;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        audit = JSON.parse(jsonMatch[0]);
      } catch (e) {
        audit = { raw: content, parseError: true };
      }

      // Calculate stats
      const findings = audit.findings || [];
      const stats = {
        critical: findings.filter(f => f.severity === 'CRITICAL').length,
        high: findings.filter(f => f.severity === 'HIGH').length,
        medium: findings.filter(f => f.severity === 'MEDIUM').length,
        low: findings.filter(f => f.severity === 'LOW').length,
        info: findings.filter(f => f.severity === 'INFO').length,
        total: findings.length,
      };

      return {
        success: true,
        contractType,
        audit,
        stats,
        meta: {
          tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens,
          timestamp: new Date().toISOString(),
          cost: this.price,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Quick vulnerability scan
   */
  async quickScan(code) {
    const contractType = this.detectContractType(code);
    
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Quick security scan of this ${contractType} contract. List ONLY vulnerabilities found.

\`\`\`
${code}
\`\`\`

Response JSON:
{
  "riskLevel": "CRITICAL|HIGH|MEDIUM|LOW|SAFE",
  "vulnerabilities": [
    { "severity": "...", "issue": "...", "location": "..." }
  ],
  "deploymentReady": true/false,
  "recommendation": "Brief recommendation"
}`
      }],
    });

    try {
      const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
      return { success: true, contractType, ...JSON.parse(jsonMatch[0]) };
    } catch (e) {
      return { success: true, raw: response.content[0].text };
    }
  }

  /**
   * Generate fix for specific vulnerability
   */
  async generateFix(code, vulnerability) {
    const contractType = this.detectContractType(code);
    
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `Fix this vulnerability in the ${contractType} contract:

Vulnerability: ${vulnerability}

Original code:
\`\`\`
${code}
\`\`\`

Provide:
{
  "fixedCode": "Complete fixed version of the code",
  "explanation": "What was changed and why",
  "additionalRecommendations": ["Other improvements to consider"]
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
   * Compare two versions of a contract
   */
  async compareVersions(oldCode, newCode) {
    const contractType = this.detectContractType(newCode);
    
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `Compare these two versions of a ${contractType} contract for security changes.

OLD VERSION:
\`\`\`
${oldCode}
\`\`\`

NEW VERSION:
\`\`\`
${newCode}
\`\`\`

Analyze:
{
  "securityChanges": [
    {
      "type": "FIXED|INTRODUCED|MODIFIED",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "description": "What changed",
      "impact": "Security impact"
    }
  ],
  "overallAssessment": "Is the new version more or less secure?",
  "recommendation": "Should this update be deployed?"
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
   * Generate security report (markdown)
   */
  async generateReport(auditResult, options = {}) {
    const { projectName = 'Smart Contract', auditor = 'AI Auditor' } = options;
    const findings = auditResult.audit?.findings || [];
    const summary = auditResult.audit?.summary || {};

    const report = `# Security Audit Report

## Project: ${projectName}
## Date: ${new Date().toISOString().split('T')[0]}
## Auditor: ${auditor}

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Contract Type | ${auditResult.contractType} |
| Overall Risk | **${summary.overallRisk || 'N/A'}** |
| Audit Score | ${summary.auditScore || 'N/A'}/100 |
| Recommendation | ${summary.recommendation || 'N/A'} |

### Findings Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | ${auditResult.stats?.critical || 0} |
| 🟠 High | ${auditResult.stats?.high || 0} |
| 🟡 Medium | ${auditResult.stats?.medium || 0} |
| 🟢 Low | ${auditResult.stats?.low || 0} |
| ℹ️ Info | ${auditResult.stats?.info || 0} |
| **Total** | **${auditResult.stats?.total || 0}** |

---

## Detailed Findings

${findings.map(f => `
### ${f.id}: ${f.title}

**Severity:** ${f.severity}  
**Location:** ${f.location}

**Description:**  
${f.description}

**Impact:**  
${f.impact}

**Recommendation:**  
${f.recommendation}

${f.fixedCode ? `**Suggested Fix:**
\`\`\`
${f.fixedCode}
\`\`\`` : ''}

---
`).join('\n')}

## Security Checklist

| Check | Status |
|-------|--------|
${Object.entries(auditResult.audit?.checklist || {}).map(([key, value]) => 
  `| ${key} | ${value ? '✅' : '❌'} |`
).join('\n')}

---

## Best Practices Recommendations

${(auditResult.audit?.bestPractices || []).map(bp => `- **${bp.category}:** ${bp.suggestion}`).join('\n')}

---

## Disclaimer

This audit was performed by an AI system and should be used as a preliminary assessment only. 
For production deployments, we recommend a professional manual audit by certified security firms.

---

*Generated by Smart Contract Auditor Agent*
`;

    return { success: true, report, format: 'markdown' };
  }

  /**
   * Express router
   */
  router(x402, recipientWallet) {
    const express = require('express');
    const router = express.Router();

    // Agent info
    router.get('/smart-contract-auditor', (req, res) => {
      res.json({
        name: this.name,
        description: this.description,
        price: this.price,
        currency: 'USDC',
        skills: this.skills,
        supportedContracts: ['solana-anchor', 'solana-native', 'solidity'],
        endpoints: {
          audit: 'POST /api/agents/smart-contract-auditor/audit',
          quickScan: 'POST /api/agents/smart-contract-auditor/quick-scan',
          fix: 'POST /api/agents/smart-contract-auditor/fix',
          compare: 'POST /api/agents/smart-contract-auditor/compare',
          report: 'POST /api/agents/smart-contract-auditor/report',
        },
      });
    });

    // Full audit (paid - most expensive)
    router.post('/smart-contract-auditor/audit',
      x402.middleware({ price: this.price, recipient: recipientWallet }),
      async (req, res) => {
        const { code, contractType, context, focusAreas } = req.body;
        
        if (!code) {
          return res.status(400).json({ error: 'code is required' });
        }

        const result = await this.audit(code, { contractType, context, focusAreas });
        res.json(result);
      }
    );

    // Quick scan (cheaper)
    router.post('/smart-contract-auditor/quick-scan',
      x402.middleware({ price: this.price * 0.4, recipient: recipientWallet }),
      async (req, res) => {
        const { code } = req.body;
        
        if (!code) {
          return res.status(400).json({ error: 'code is required' });
        }

        const result = await this.quickScan(code);
        res.json(result);
      }
    );

    // Generate fix (paid)
    router.post('/smart-contract-auditor/fix',
      x402.middleware({ price: this.price * 0.5, recipient: recipientWallet }),
      async (req, res) => {
        const { code, vulnerability } = req.body;
        
        if (!code || !vulnerability) {
          return res.status(400).json({ error: 'code and vulnerability are required' });
        }

        const result = await this.generateFix(code, vulnerability);
        res.json(result);
      }
    );

    // Compare versions (paid)
    router.post('/smart-contract-auditor/compare',
      x402.middleware({ price: this.price * 0.6, recipient: recipientWallet }),
      async (req, res) => {
        const { oldCode, newCode } = req.body;
        
        if (!oldCode || !newCode) {
          return res.status(400).json({ error: 'oldCode and newCode are required' });
        }

        const result = await this.compareVersions(oldCode, newCode);
        res.json(result);
      }
    );

    // Generate report (paid)
    router.post('/smart-contract-auditor/report',
      x402.middleware({ price: this.price * 0.3, recipient: recipientWallet }),
      async (req, res) => {
        const { auditResult, projectName, auditor } = req.body;
        
        if (!auditResult) {
          return res.status(400).json({ error: 'auditResult is required (from /audit endpoint)' });
        }

        const result = await this.generateReport(auditResult, { projectName, auditor });
        res.json(result);
      }
    );

    return router;
  }
}

module.exports = { SmartContractAuditorAgent };
