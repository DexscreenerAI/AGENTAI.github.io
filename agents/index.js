const { CodeReviewerAgent } = require('./code-reviewer');
const { SolanaAnalyzerAgent } = require('./solana-analyzer');
const { ContentWriterAgent } = require('./content-writer');
const { SmartContractAuditorAgent } = require('./smart-contract-auditor');

function initializeAgents(config = {}) {
  return {
    codeReviewer: new CodeReviewerAgent(config),
    solanaAnalyzer: new SolanaAnalyzerAgent(config),
    contentWriter: new ContentWriterAgent(config),
    smartContractAuditor: new SmartContractAuditorAgent(config),
  };
}

function mountAgentRouters(app, agents, x402, recipientWallet) {
  app.use('/api/agents', agents.codeReviewer.router(x402, recipientWallet));
  app.use('/api/agents', agents.solanaAnalyzer.router(x402, recipientWallet));
  app.use('/api/agents', agents.contentWriter.router(x402, recipientWallet));
  app.use('/api/agents', agents.smartContractAuditor.router(x402, recipientWallet));
  
  app.get('/api/agents/registry', (req, res) => {
    res.json({
      success: true,
      agents: [
        { id: 'solana-analyzer', name: 'Solana Analyzer', price: 0.50, endpoints: ['/analyze', '/quick-check', '/compare'] },
        { id: 'code-reviewer', name: 'Code Reviewer', price: 0.25, endpoints: ['/review', '/security'] },
        { id: 'smart-contract-auditor', name: 'Smart Contract Auditor', price: 1.00, endpoints: ['/audit', '/quick-scan', '/fix'] },
        { id: 'content-writer', name: 'Content Writer', price: 0.20, endpoints: ['/generate', '/thread', '/tiktok'] },
      ]
    });
  });
}

module.exports = { initializeAgents, mountAgentRouters };
