/**
 * AGENTS INDEX - 7 AI Agents
 */

const { CodeReviewerAgent } = require('./code-reviewer');
const { SolanaAnalyzerAgent } = require('./solana-analyzer');
const { ContentWriterAgent } = require('./content-writer');
const { SmartContractAuditorAgent } = require('./smart-contract-auditor');
const { WalletAnalyzerAgent } = require('./wallet-analyzer');
const { ExitSignalAgent } = require('./exit-signal');
const { WhaleTrackerAgent } = require('./whale-tracker');

function initializeAgents(config = {}) {
  return {
    codeReviewer: new CodeReviewerAgent(config),
    solanaAnalyzer: new SolanaAnalyzerAgent(config),
    contentWriter: new ContentWriterAgent(config),
    smartContractAuditor: new SmartContractAuditorAgent(config),
    walletAnalyzer: new WalletAnalyzerAgent(config),
    exitSignal: new ExitSignalAgent(config),
    whaleTracker: new WhaleTrackerAgent(config),
  };
}

function mountAgentRouters(app, agents, x402, recipientWallet) {
  // Mount all agent routers
  app.use('/api/agents', agents.codeReviewer.router(x402, recipientWallet));
  app.use('/api/agents', agents.solanaAnalyzer.router(x402, recipientWallet));
  app.use('/api/agents', agents.contentWriter.router(x402, recipientWallet));
  app.use('/api/agents', agents.smartContractAuditor.router(x402, recipientWallet));
  app.use('/api/agents', agents.walletAnalyzer.router(x402, recipientWallet));
  app.use('/api/agents', agents.exitSignal.router(x402, recipientWallet));
  app.use('/api/agents', agents.whaleTracker.router(x402, recipientWallet));
  
  // Agent registry endpoint
  app.get('/api/agents/registry', (req, res) => {
    res.json({
      success: true,
      totalAgents: 7,
      categories: ['analysis', 'trading', 'tracking', 'development', 'content'],
      agents: [
        // Analysis
        { 
          id: 'solana-analyzer', 
          name: 'Solana Analyzer', 
          description: 'Token analysis with DexScreener + Rugcheck + AI',
          price: 0.10, 
          category: 'analysis',
          endpoints: [
            { path: '/analyze', price: 0.10 },
            { path: '/quick-check', price: 0.05 },
            { path: '/compare', price: 0.20 },
          ] 
        },
        { 
          id: 'wallet-analyzer', 
          name: 'Wallet Analyzer', 
          description: 'Portfolio analysis, PnL, trading patterns',
          price: 0.10, 
          category: 'analysis',
          endpoints: [
            { path: '/analyze', price: 0.10 },
            { path: '/quick', price: 0.05 },
            { path: '/compare', price: 0.15 },
          ] 
        },
        // Trading
        { 
          id: 'exit-signal', 
          name: 'Exit Signal', 
          description: 'AI-powered sell timing with technical analysis',
          price: 0.10, 
          category: 'trading',
          endpoints: [
            { path: '/analyze', price: 0.10 },
            { path: '/quick', price: 0.05 },
            { path: '/monitor', price: 0.15 },
          ] 
        },
        // Tracking
        { 
          id: 'whale-tracker', 
          name: 'Whale Tracker', 
          description: 'Track whales, detect accumulation/distribution',
          price: 0.10, 
          category: 'tracking',
          endpoints: [
            { path: '/track', price: 0.10 },
            { path: '/quick', price: 0.05 },
            { path: '/wallet', price: 0.10 },
            { path: '/multi', price: 0.15 },
          ] 
        },
        // Development
        { 
          id: 'code-reviewer', 
          name: 'Code Reviewer', 
          description: 'Security & best practices code review',
          price: 0.05, 
          category: 'development',
          endpoints: [
            { path: '/review', price: 0.05 },
            { path: '/security', price: 0.03 },
          ] 
        },
        { 
          id: 'smart-contract-auditor', 
          name: 'Smart Contract Auditor', 
          description: 'Solana/Ethereum contract security audit',
          price: 0.25, 
          category: 'development',
          endpoints: [
            { path: '/audit', price: 0.25 },
            { path: '/quick-scan', price: 0.10 },
            { path: '/fix', price: 0.15 },
          ] 
        },
        // Content
        { 
          id: 'content-writer', 
          name: 'Content Writer', 
          description: 'Twitter, TikTok, blog content generation',
          price: 0.05, 
          category: 'content',
          endpoints: [
            { path: '/generate', price: 0.05 },
            { path: '/thread', price: 0.08 },
            { path: '/tiktok', price: 0.06 },
            { path: '/calendar', price: 0.15 },
          ] 
        },
      ]
    });
  });
}

module.exports = { 
  initializeAgents, 
  mountAgentRouters,
  CodeReviewerAgent,
  SolanaAnalyzerAgent,
  ContentWriterAgent,
  SmartContractAuditorAgent,
  WalletAnalyzerAgent,
  ExitSignalAgent,
  WhaleTrackerAgent,
};
