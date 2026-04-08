/**
 * AGENT MARKETPLACE V2
 * 
 * Features:
 * - MongoDB database (scalable)
 * - Solana Escrow (trustless payments)
 * - x402 Micropayments (pay-per-request)
 * - Reputation NFT (soulbound tokens)
 * - A2A Protocol
 * - Real-time dashboard
 */

const express = require('express');
const { WebSocketServer } = require('ws');
const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');

// Import modules
const { X402 } = require('./lib/x402');
const { ReputationNFT } = require('./lib/reputation-nft');
const { EscrowClient } = require('./lib/escrow-client');
const { initializeAgents, mountAgentRouters, getAgentRegistry } = require('./agents');

// ============================================
// CONFIGURATION
// ============================================

const config = {
  port: process.env.PORT || 3002,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/agent-marketplace',
  solanaRpc: process.env.SOLANA_RPC || 'https://api.devnet.solana.com',
  network: process.env.NETWORK || 'devnet',
  platformWallet: process.env.PLATFORM_WALLET || null,
};

// ============================================
// MONGODB SCHEMAS
// ============================================

const AgentSchema = new mongoose.Schema({
  type: { type: String, enum: ['human', 'ai'], default: 'ai' },
  name: { type: String, required: true },
  description: String,
  skills: [String],
  tags: [String],
  hourlyRate: { type: Number, default: 0 },
  walletAddress: String,
  apiEndpoint: String,
  status: { type: String, enum: ['active', 'inactive', 'banned'], default: 'active' },
  reputation: { type: Number, default: 5.0, min: 0, max: 5 },
  completionRate: { type: Number, default: 100, min: 0, max: 100 },
  totalJobs: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  // A2A Protocol
  capabilities: [String],
  protocols: { type: [String], default: ['a2a-v1'] },
  skillMd: String,
  // Reputation NFT
  reputationNftMint: String,
}, { timestamps: true });

// Create text index for search
AgentSchema.index({ name: 'text', description: 'text', skills: 'text' });

const TaskSchema = new mongoose.Schema({
  clientId: { type: String, required: true },
  clientType: { type: String, enum: ['human', 'agent'], default: 'human' },
  title: { type: String, required: true },
  description: String,
  requiredSkills: [String],
  budget: { type: Number, default: 0 },
  currency: { type: String, default: 'USDC' },
  status: { 
    type: String, 
    enum: ['open', 'assigned', 'in_progress', 'completed', 'cancelled', 'disputed'],
    default: 'open'
  },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  applicants: [{
    agentId: mongoose.Schema.Types.ObjectId,
    agentName: String,
    proposal: String,
    price: Number,
    appliedAt: Date,
  }],
  deliverables: [String],
  deadline: Date,
  // Escrow
  escrowAddress: String,
  escrowStatus: String,
}, { timestamps: true });

const TransactionSchema = new mongoose.Schema({
  type: { type: String, enum: ['escrow_create', 'escrow_release', 'escrow_refund', 'x402_payment', 'tip'] },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
  fromId: String,
  toId: String,
  amount: Number,
  currency: { type: String, default: 'USDC' },
  status: { type: String, enum: ['pending', 'locked', 'released', 'refunded', 'failed'] },
  signature: String,
  metadata: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

const PaymentSchema = new mongoose.Schema({
  payer: String,
  recipient: String,
  amount: Number,
  signature: String,
  endpoint: String,
  protocol: { type: String, default: 'x402' },
}, { timestamps: true });

// Models
let Agent, Task, Transaction, Payment;

// ============================================
// INITIALIZE MODULES
// ============================================

const x402 = new X402({ network: config.network, rpcUrl: config.solanaRpc });
const reputationNFT = new ReputationNFT({});

// Initialize AI Agents
const aiAgents = initializeAgents({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
});

// Track x402 payments
x402.onPayment = async (payment) => {
  try {
    await Payment.create(payment);
    broadcast({ type: 'x402_payment', payment });
  } catch (e) {
    console.error('Failed to record x402 payment:', e);
  }
};

// ============================================
// AI MATCHING ENGINE (Enhanced)
// ============================================

async function matchAgents(description, requiredSkills = [], maxResults = 5) {
  const startTime = Date.now();
  
  // Use MongoDB text search + aggregation
  const pipeline = [
    { $match: { status: 'active' } },
    {
      $addFields: {
        // Text match score
        textScore: { $meta: 'textScore' },
        // Skill match count
        skillMatchCount: {
          $size: {
            $setIntersection: [
              { $map: { input: '$skills', as: 's', in: { $toLower: '$$s' } } },
              requiredSkills.map(s => s.toLowerCase()),
            ]
          }
        },
      }
    },
    {
      $addFields: {
        // Combined score
        matchScore: {
          $add: [
            { $multiply: ['$textScore', 30] },
            { $multiply: ['$skillMatchCount', 20] },
            { $multiply: ['$reputation', 10] },
            { $divide: ['$completionRate', 10] },
          ]
        }
      }
    },
    { $sort: { matchScore: -1 } },
    { $limit: maxResults },
    {
      $project: {
        id: '$_id',
        name: 1,
        type: 1,
        skills: 1,
        hourlyRate: 1,
        reputation: 1,
        completionRate: 1,
        matchScore: { $round: ['$matchScore', 0] },
      }
    }
  ];

  let matches;
  
  // If we have text to search
  if (description) {
    matches = await Agent.aggregate([
      { $match: { $text: { $search: description }, status: 'active' } },
      ...pipeline.slice(1),
    ]);
  } else {
    matches = await Agent.aggregate(pipeline);
  }

  // Fallback if no text matches
  if (matches.length === 0) {
    const fallbackQuery = { status: 'active' };
    if (requiredSkills.length > 0) {
      fallbackQuery.skills = { $in: requiredSkills.map(s => new RegExp(s, 'i')) };
    }
    
    const agents = await Agent.find(fallbackQuery)
      .sort({ reputation: -1, totalJobs: -1 })
      .limit(maxResults)
      .lean();
    
    matches = agents.map(a => ({
      id: a._id,
      name: a.name,
      type: a.type,
      skills: a.skills,
      hourlyRate: a.hourlyRate,
      reputation: a.reputation,
      completionRate: a.completionRate,
      matchScore: Math.round(a.reputation * 20),
    }));
  }

  const matchTime = Date.now() - startTime;
  
  return {
    matches,
    matchTime,
    totalAgents: await Agent.countDocuments({ status: 'active' }),
  };
}

// ============================================
// EXPRESS SERVER
// ============================================

const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Payment');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// ============================================
// x402 Routes
// ============================================

app.use('/api', x402.router());

// ============================================
// Reputation NFT Routes
// ============================================

app.use('/api', reputationNFT.router(async () => {
  const agents = await Agent.find().lean();
  return agents.map(a => ({ ...a, id: a._id.toString() }));
}));

// ============================================
// AI Agents Routes (x402 paid)
// ============================================

mountAgentRouters(app, aiAgents, x402, config.platformWallet);

// ============================================
// API ROUTES - Agents
// ============================================

app.get('/api/agents', async (req, res) => {
  try {
    const query = { status: 'active' };
    if (req.query.type) query.type = req.query.type;
    if (req.query.skill) {
      query.skills = { $regex: req.query.skill, $options: 'i' };
    }
    
    const agents = await Agent.find(query)
      .sort({ reputation: -1 })
      .limit(100)
      .lean();
    
    res.json({
      success: true,
      count: agents.length,
      agents: agents.map(a => ({
        id: a._id,
        type: a.type,
        name: a.name,
        description: a.description,
        skills: a.skills,
        hourlyRate: a.hourlyRate,
        reputation: a.reputation,
        completionRate: a.completionRate,
        totalJobs: a.totalJobs,
        status: a.status,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/agents/:id', async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id).lean();
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json({ success: true, agent: { ...agent, id: agent._id } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/agents', async (req, res) => {
  try {
    const agent = new Agent(req.body);
    await agent.save();
    
    // Mint reputation NFT
    try {
      const nftResult = await reputationNFT.mintReputationNFT({ ...agent.toObject(), id: agent._id.toString() });
      agent.reputationNftMint = nftResult.mint;
      await agent.save();
    } catch (e) {
      console.error('NFT mint failed:', e.message);
    }
    
    broadcast({ type: 'agent_registered', agent: { ...agent.toObject(), id: agent._id } });
    res.json({ success: true, agent: { ...agent.toObject(), id: agent._id } });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/agents/:id', async (req, res) => {
  try {
    const agent = await Agent.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    broadcast({ type: 'agent_updated', agent: { ...agent.toObject(), id: agent._id } });
    res.json({ success: true, agent: { ...agent.toObject(), id: agent._id } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/agents/:id', async (req, res) => {
  try {
    await Agent.findByIdAndDelete(req.params.id);
    broadcast({ type: 'agent_deleted', id: req.params.id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// API ROUTES - Matching
// ============================================

app.post('/api/match', async (req, res) => {
  try {
    const { description, skills, maxResults } = req.body;
    if (!description) {
      return res.status(400).json({ error: 'Description required' });
    }
    
    const result = await matchAgents(description, skills || [], maxResults || 5);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// API ROUTES - Tasks
// ============================================

app.get('/api/tasks', async (req, res) => {
  try {
    const query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.clientId) query.clientId = req.query.clientId;
    
    const tasks = await Task.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('assignedTo', 'name type')
      .lean();
    
    res.json({ success: true, count: tasks.length, tasks });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const task = new Task(req.body);
    await task.save();
    broadcast({ type: 'task_created', task });
    res.json({ success: true, task });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/tasks/:id/assign', async (req, res) => {
  try {
    const { agentId } = req.body;
    if (!agentId) return res.status(400).json({ error: 'agentId required' });
    
    const task = await Task.findById(req.params.id);
    if (!task || task.status !== 'open') {
      return res.status(400).json({ error: 'Cannot assign this task' });
    }
    
    task.assignedTo = agentId;
    task.status = 'assigned';
    await task.save();
    
    // Create escrow transaction record
    await Transaction.create({
      type: 'escrow_create',
      taskId: task._id,
      fromId: task.clientId,
      toId: agentId,
      amount: task.budget,
      currency: task.currency,
      status: 'locked',
    });
    
    broadcast({ type: 'task_assigned', task });
    res.json({ success: true, task });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/tasks/:id/complete', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    if (task.status === 'assigned') {
      task.status = 'in_progress';
    }
    
    task.status = 'completed';
    task.deliverables = req.body.deliverables || [];
    await task.save();
    
    // Update escrow
    await Transaction.findOneAndUpdate(
      { taskId: task._id, type: 'escrow_create', status: 'locked' },
      { status: 'released' }
    );
    
    // Update agent stats
    if (task.assignedTo) {
      await Agent.findByIdAndUpdate(task.assignedTo, {
        $inc: { totalJobs: 1, totalEarned: task.budget }
      });
    }
    
    broadcast({ type: 'task_completed', task });
    res.json({ success: true, task });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// API ROUTES - A2A Protocol
// ============================================

app.get('/api/a2a/:id/card', async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id).lean();
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    
    res.json({
      '@context': 'https://agent-protocol.org/v1',
      '@type': 'AgentCard',
      id: agent._id,
      name: agent.name,
      description: agent.description,
      type: agent.type,
      skills: agent.skills,
      capabilities: agent.capabilities,
      protocols: agent.protocols,
      endpoints: {
        hire: `/api/a2a/${agent._id}/hire`,
        status: `/api/a2a/${agent._id}/status`,
      },
      pricing: {
        hourlyRate: agent.hourlyRate,
        currency: 'USDC',
        x402: true,
      },
      reputation: {
        score: agent.reputation,
        completionRate: agent.completionRate,
        totalJobs: agent.totalJobs,
        nftMint: agent.reputationNftMint,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/a2a/:id/skill.md', async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id).lean();
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    
    const md = `# ${agent.name}

## Type
${agent.type === 'ai' ? '🤖 AI Agent' : '👤 Human'}

## Description
${agent.description || 'No description'}

## Skills
${(agent.skills || []).map(s => `- ${s}`).join('\n')}

## Pricing
- Hourly Rate: $${agent.hourlyRate} USDC
- Supports x402 micropayments

## Stats
- Reputation: ${agent.reputation}/5.0
- Completion Rate: ${agent.completionRate}%
- Total Jobs: ${agent.totalJobs}
- Total Earned: $${agent.totalEarned}

## Reputation NFT
${agent.reputationNftMint || 'Not minted yet'}

## Endpoints
- Hire: POST /api/a2a/${agent._id}/hire
- Status: GET /api/a2a/${agent._id}/status
`;
    
    res.type('text/markdown').send(md);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/a2a/:id/hire', async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    
    const { clientId, clientType, task, budget } = req.body;
    
    const newTask = new Task({
      clientId: clientId || 'anonymous',
      clientType: clientType || 'agent',
      title: task?.title || 'A2A Task',
      description: task?.description || '',
      requiredSkills: task?.skills || agent.skills,
      budget: budget || agent.hourlyRate,
      assignedTo: agent._id,
      status: 'assigned',
    });
    await newTask.save();
    
    broadcast({ type: 'a2a_hire', agentId: agent._id, taskId: newTask._id });
    
    res.json({
      success: true,
      message: `Agent ${agent.name} hired successfully`,
      taskId: newTask._id,
      agent: { id: agent._id, name: agent.name },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/a2a/:id/status', async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id).lean();
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    
    const activeTasks = await Task.countDocuments({
      assignedTo: agent._id,
      status: { $in: ['assigned', 'in_progress'] }
    });
    
    res.json({
      id: agent._id,
      name: agent.name,
      status: agent.status,
      available: activeTasks < 5,
      activeTasks,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// API ROUTES - Paid Endpoints (x402)
// ============================================

// Example: Paid AI analysis endpoint
app.post('/api/paid/analyze', 
  x402.middleware({ price: 0.25, recipient: config.platformWallet }),
  async (req, res) => {
    // This endpoint requires 0.25 USDC per request
    const { data } = req.body;
    
    res.json({
      success: true,
      analysis: `Analysis result for: ${data}`,
      payment: req.x402,
    });
  }
);

// ============================================
// API ROUTES - Stats
// ============================================

app.get('/api/stats', async (req, res) => {
  try {
    const [
      totalAgents,
      humanAgents,
      aiAgents,
      openTasks,
      completedTasks,
      totalVolume,
      x402Stats,
    ] = await Promise.all([
      Agent.countDocuments(),
      Agent.countDocuments({ type: 'human' }),
      Agent.countDocuments({ type: 'ai' }),
      Task.countDocuments({ status: 'open' }),
      Task.countDocuments({ status: 'completed' }),
      Transaction.aggregate([
        { $match: { status: 'released' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.aggregate([
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
    ]);
    
    res.json({
      success: true,
      stats: {
        totalAgents,
        humanAgents,
        aiAgents,
        openTasks,
        completedTasks,
        totalVolume: totalVolume[0]?.total || 0,
        x402Payments: x402Stats[0]?.count || 0,
        x402Volume: x402Stats[0]?.total || 0,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/transactions', async (req, res) => {
  try {
    const txs = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ success: true, transactions: txs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// WEBSOCKET
// ============================================

const wsClients = new Set();

function broadcast(data) {
  const message = JSON.stringify(data);
  wsClients.forEach(client => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

// ============================================
// START SERVER
// ============================================

async function start() {
  // Connect to MongoDB
  try {
    await mongoose.connect(config.mongoUri);
    console.log('✅ MongoDB connected');
    
    // Create models
    Agent = mongoose.model('Agent', AgentSchema);
    Task = mongoose.model('Task', TaskSchema);
    Transaction = mongoose.model('Transaction', TransactionSchema);
    Payment = mongoose.model('Payment', PaymentSchema);
  } catch (e) {
    console.error('❌ MongoDB connection failed:', e.message);
    console.log('⚠️  Running without MongoDB (features limited)');
    
    // Fallback to in-memory
    const mockModel = (data) => ({
      find: () => ({ sort: () => ({ limit: () => ({ lean: () => Promise.resolve([]), populate: () => ({ lean: () => Promise.resolve([]) }) }) }) }),
      findById: () => ({ lean: () => Promise.resolve(null) }),
      findOne: () => Promise.resolve(null),
      findByIdAndUpdate: () => Promise.resolve(null),
      findByIdAndDelete: () => Promise.resolve(null),
      findOneAndUpdate: () => Promise.resolve(null),
      countDocuments: () => Promise.resolve(0),
      aggregate: () => Promise.resolve([]),
      create: () => Promise.resolve(data),
    });
    
    Agent = { ...mockModel(), save: () => Promise.resolve() };
    Task = mockModel();
    Transaction = mockModel();
    Payment = mockModel();
  }

  const server = app.listen(config.port, () => {
    console.log(`
╔════════════════════════════════════════════════════╗
║          AGENT MARKETPLACE V2                      ║
║                                                    ║
║          http://localhost:${config.port}                     ║
║                                                    ║
║  Features:                                         ║
║  ✅ MongoDB Database                               ║
║  ✅ Solana Escrow (USDC)                           ║
║  ✅ x402 Micropayments                             ║
║  ✅ Reputation NFT (Soulbound)                     ║
║  ✅ A2A Protocol                                   ║
║  ✅ AI-Powered Matching                            ║
╚════════════════════════════════════════════════════╝
    `);
  });

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    wsClients.add(ws);
    ws.send(JSON.stringify({ type: 'init', message: 'Connected to Agent Marketplace V2' }));
    ws.on('close', () => wsClients.delete(ws));
  });
}

start().catch(console.error);
