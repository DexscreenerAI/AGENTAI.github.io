/**
 * AGENTS INDEX
 * 
 * All AI agents available on the marketplace
 */

const { CodeReviewerAgent } = require('./code-reviewer');
const { SolanaAnalyzerAgent } = require('./solana-analyzer');
const { ContentWriterAgent } = require('./content-writer');
const { SmartContractAuditorAgent } = require('./smart-contract-auditor');

/**
 * Initialize all agents with configuration
 */
function initializeAgents(config = {}) {
  return {
    codeReviewer: new CodeReviewerAgent(config),
    solanaAnalyzer: new SolanaAnalyzerAgent(config),
    contentWriter: new ContentWriterAgent(config),
    smartContractAuditor: new SmartContractAuditorAgent(config),
  };
}

/**
 * Get agent registry (for marketplace listing)
 */
function getAgentRegistry(agents) {
  return [
    {
      id: 'code-reviewer',
      name: agents.codeReviewer.name,
      description: agents.codeReviewer.description,
      price: agents.codeReviewer.price,
      skills: agents.codeReviewer.skills,
      type: 'ai',
      status: 'active',
      endpoints: [
        { path: '/review', price: 0.25, description: 'Full code review' },
        { path: '/security', price: 0.15, description: 'Security scan only' },
      ],
    },
    {
      id: 'solana-analyzer',
      name: agents.solanaAnalyzer.name,
      description: agents.solanaAnalyzer.description,
      price: agents.solanaAnalyzer.price,
      skills: agents.solanaAnalyzer.skills,
      type: 'ai',
      status: 'active',
      endpoints: [
        { path: '/analyze', price: 0.50, description: 'Full token analysis' },
        { path: '/quick-check', price: 0.20, description: 'Quick risk check' },
        { path: '/compare', price: 1.00, description: 'Compare multiple tokens' },
      ],
    },
    {
      id: 'content-writer',
      name: agents.contentWriter.name,
      description: agents.contentWriter.description,
      price: agents.contentWriter.price,
      skills: agents.contentWriter.skills,
      type: 'ai',
      status: 'active',
      endpoints: [
        { path: '/generate', price: 0.20, description: 'Generate content' },
        { path: '/thread', price: 0.30, description: 'Twitter thread' },
        { path: '/tiktok', price: 0.24, description: 'TikTok script' },
        { path: '/rewrite', price: 0.20, description: 'Rewrite content' },
        { path: '/calendar', price: 0.60, description: 'Content calendar' },
      ],
    },
    {
      id: 'smart-contract-auditor',
      name: agents.smartContractAuditor.name,
      description: agents.smartContractAuditor.description,
      price: agents.smartContractAuditor.price,
      skills: agents.smartContractAuditor.skills,
      type: 'ai',
      status: 'active',
      endpoints: [
        { path: '/audit', price: 1.00, description: 'Full security audit' },
        { path: '/quick-scan', price: 0.40, description: 'Quick vulnerability scan' },
        { path: '/fix', price: 0.50, description: 'Generate fix for vulnerability' },
        { path: '/compare', price: 0.60, description: 'Compare contract versions' },
        { path: '/report', price: 0.30, description: 'Generate audit report' },
      ],
    },
  ];
}

/**
 * Mount all agent routers
 */
function mountAgentRouters(app, agents, x402, recipientWallet) {
  app.use('/api/agents', agents.codeReviewer.router(x402, recipientWallet));
  app.use('/api/agents', agents.solanaAnalyzer.router(x402, recipientWallet));
  app.use('/api/agents', agents.contentWriter.router(x402, recipientWallet));
  app.use('/api/agents', agents.smartContractAuditor.router(x402, recipientWallet));
  
  // Agent registry endpoint
  app.get('/api/agents/registry', (req, res) => {
    res.json({
      success: true,
      agents: getAgentRegistry(agents),
      totalAgents: 4,
      protocol: 'x402',
    });
  });
}

module.exports = {
  initializeAgents,
  getAgentRegistry,
  mountAgentRouters,
  CodeReviewerAgent,
  SolanaAnalyzerAgent,
  ContentWriterAgent,
  SmartContractAuditorAgent,
};
