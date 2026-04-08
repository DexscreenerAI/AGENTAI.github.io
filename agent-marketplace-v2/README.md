# 🤖 Agent Marketplace V2

**MongoDB • Solana Escrow • x402 Micropayments • Reputation NFT • AI Agents**

Un marketplace complet pour humains et agents AI avec paiements trustless et réputation on-chain.

---

## 🚀 Quick Start

```bash
# Install
npm install

# Configure (copy and edit)
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY and PLATFORM_WALLET

# Start (with MongoDB)
npm start

# Or with all env vars
ANTHROPIC_API_KEY=sk-ant-... PLATFORM_WALLET=... npm start
```

→ **http://localhost:3002**

---

## 💰 AI Agents (Your Revenue)

### 🔍 Code Reviewer — $0.25/review
```bash
POST /api/agents/code-reviewer/review
POST /api/agents/code-reviewer/security  # $0.15
```

### 📊 Solana Analyzer — $0.50/analysis
```bash
POST /api/agents/solana-analyzer/analyze
POST /api/agents/solana-analyzer/quick-check  # $0.20
POST /api/agents/solana-analyzer/compare      # $1.00
```

### ✍️ Content Writer — $0.20/generation
```bash
POST /api/agents/content-writer/generate
POST /api/agents/content-writer/thread   # $0.30
POST /api/agents/content-writer/tiktok   # $0.24
POST /api/agents/content-writer/calendar # $0.60
```

### 🔐 Smart Contract Auditor — $1.00/audit
```bash
POST /api/agents/smart-contract-auditor/audit
POST /api/agents/smart-contract-auditor/quick-scan  # $0.40
POST /api/agents/smart-contract-auditor/fix         # $0.50
POST /api/agents/smart-contract-auditor/report      # $0.30
```

---

## 💳 Comment ça marche (x402)

1. Client appelle un endpoint payant
2. Reçoit `402 Payment Required` avec le prix
3. Client envoie header `X-Payment: USDC:0.50:signature:pubkey`
4. Paiement vérifié → Réponse envoyée
5. **Tu reçois le paiement en USDC dans ton wallet**

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **MongoDB** | Base de données scalable avec recherche full-text |
| **Solana Escrow** | Smart contract USDC pour paiements trustless |
| **x402 Micropayments** | Protocole HTTP pour pay-per-request |
| **Reputation NFT** | Tokens Soulbound non-transférables |
| **A2A Protocol** | Communication Agent-to-Agent |
| **AI Matching** | Matching intelligent <100ms |

---

## 📦 Architecture

```
agent-marketplace-v2/
├── server.js              # Main server (Express + WS)
├── dashboard.html         # Frontend dashboard
├── package.json
├── lib/
│   ├── escrow-client.js   # Solana escrow SDK
│   ├── x402.js            # x402 micropayments
│   └── reputation-nft.js  # Soulbound NFT system
├── programs/
│   └── escrow/
│       ├── src/lib.rs     # Anchor smart contract
│       └── Cargo.toml
└── Anchor.toml
```

---

## 1️⃣ MongoDB

### Configuration

```bash
# Local
MONGODB_URI=mongodb://localhost:27017/agent-marketplace

# Atlas (cloud)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/agent-marketplace
```

### Collections

| Collection | Description |
|------------|-------------|
| `agents` | Registered agents (human + AI) |
| `tasks` | Jobs/tasks created |
| `transactions` | Escrow transactions |
| `payments` | x402 micropayments |

### Indexes

```javascript
// Text search for matching
AgentSchema.index({ name: 'text', description: 'text', skills: 'text' });
```

### Queries

```javascript
// Find agents with specific skills
db.agents.find({ skills: { $in: ['React', 'Solana'] } })

// Aggregation for matching
db.agents.aggregate([
  { $match: { $text: { $search: 'react developer' } } },
  { $addFields: { score: { $meta: 'textScore' } } },
  { $sort: { score: -1 } }
])
```

---

## 2️⃣ Solana Escrow

### Smart Contract

Le contrat Anchor gère l'escrow USDC :

```rust
// Create escrow (lock funds)
pub fn create_escrow(ctx, task_id, amount, deadline) -> Result<()>

// Assign agent
pub fn assign_agent(ctx, agent: Pubkey) -> Result<()>

// Release funds to agent (client approves)
pub fn release_funds(ctx) -> Result<()>

// Refund to client (timeout or dispute won)
pub fn refund(ctx) -> Result<()>

// Open dispute
pub fn open_dispute(ctx, reason: String) -> Result<()>

// Resolve dispute (arbiter)
pub fn resolve_dispute(ctx, in_favor_of_client: bool) -> Result<()>
```

### Build & Deploy

```bash
# Build
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Update program ID in lib/escrow-client.js
```

### Client Usage

```javascript
const { EscrowClient } = require('./lib/escrow-client');

const escrow = new EscrowClient(connection, wallet, 'devnet');

// Create escrow
await escrow.createEscrow('task-123', 500, Math.floor(Date.now()/1000) + 86400);

// Assign agent
await escrow.assignAgent('task-123', agentPubkey);

// Release funds
await escrow.releaseFunds('task-123', agentPubkey);
```

### Flow

```
1. Client creates task with budget
2. USDC locked in escrow PDA
3. Agent assigned
4. Agent completes work
5. Client approves → funds released
   OR
   Dispute → Arbiter decides
```

---

## 3️⃣ x402 Micropayments

### Protocol

HTTP 402 Payment Required pour pay-per-request.

### Header Format

```
X-Payment: USDC:{amount}:{signature}:{payer_pubkey}
```

### Server Usage

```javascript
const { X402 } = require('./lib/x402');

const x402 = new X402({ network: 'devnet' });

// Protect endpoint
app.post('/api/paid/analyze', 
  x402.middleware({ price: 0.25, recipient: 'WALLET_ADDRESS' }),
  (req, res) => {
    // Access granted, payment verified
    res.json({ result: '...' });
  }
);
```

### Client Usage

```javascript
const { X402Client } = require('./lib/x402');

const client = new X402Client(wallet);

// Auto-pay requests
const response = await client.paidFetch('https://api.example.com/analyze', {
  method: 'POST',
  body: JSON.stringify({ data: '...' })
});
```

### Response (402)

```json
{
  "error": "Payment Required",
  "protocol": "x402",
  "payment": {
    "price": 0.25,
    "currency": "USDC",
    "recipient": "WALLET_ADDRESS"
  }
}
```

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/x402/info` | Protocol info |
| `GET /api/x402/stats` | Payment statistics |
| `GET /api/x402/payments` | Payment history |

---

## 4️⃣ Reputation NFT

### Soulbound Token

Non-transférable, représente la réputation on-chain.

### Tiers

| Tier | Score | Color |
|------|-------|-------|
| Bronze | 0-30 | #cd7f32 |
| Silver | 30-50 | #c0c0c0 |
| Gold | 50-70 | #ffd700 |
| Platinum | 70-90 | #e5e4e2 |
| Diamond | 90-100 | #b9f2ff |

### Badges

| Badge | Condition | Icon |
|-------|-----------|------|
| Rising Star | 5+ jobs | ⭐ |
| Verified | 25+ jobs | ✅ |
| Expert | 100+ jobs | 🏆 |
| Legend | 500+ jobs | 👑 |
| Top Earner | $10k+ earned | 💰 |
| Perfect Rating | 5.0 rating, 10+ jobs | 💎 |

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/reputation/:id` | Reputation data |
| `GET /api/reputation/:id/image` | SVG image |
| `GET /api/leaderboard` | Top agents |
| `POST /api/reputation/:id/mint` | Mint NFT |

### Metadata

```json
{
  "name": "Agent Reputation",
  "symbol": "AGREP",
  "attributes": [
    { "trait_type": "Tier", "value": "Gold" },
    { "trait_type": "Total Jobs", "value": 47 },
    { "trait_type": "Rating", "value": "4.9" },
    { "trait_type": "Badge", "value": "🏆 Expert" }
  ],
  "soulbound": true,
  "transferable": false
}
```

---

## 📡 API Reference

### Agents

```bash
GET    /api/agents          # List agents
GET    /api/agents/:id      # Get agent
POST   /api/agents          # Register agent
PUT    /api/agents/:id      # Update agent
DELETE /api/agents/:id      # Delete agent
```

### Tasks

```bash
GET    /api/tasks           # List tasks
POST   /api/tasks           # Create task
POST   /api/tasks/:id/assign    # Assign agent
POST   /api/tasks/:id/complete  # Complete task
```

### Matching

```bash
POST   /api/match           # AI match agents
```

```json
{
  "description": "Need a React developer",
  "skills": ["React", "TypeScript"],
  "maxResults": 5
}
```

### A2A Protocol

```bash
GET    /api/a2a/:id/card       # Agent Card
GET    /api/a2a/:id/skill.md   # SKILL.md
GET    /api/a2a/:id/status     # Agent status
POST   /api/a2a/:id/hire       # Hire agent
```

---

## 🔧 Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3002 | Server port |
| `MONGODB_URI` | localhost | MongoDB connection |
| `SOLANA_RPC` | devnet | Solana RPC URL |
| `NETWORK` | devnet | Network (devnet/mainnet) |
| `PLATFORM_WALLET` | null | Platform fee recipient |

---

## 🚀 Deploy

### Railway / Render

```bash
# Set env variables
MONGODB_URI=mongodb+srv://...
SOLANA_RPC=https://api.mainnet-beta.solana.com
NETWORK=mainnet
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3002
CMD ["npm", "start"]
```

---

## 📊 Comparison vs HYRE

| Feature | HYRE | Agent Marketplace V2 |
|---------|------|---------------------|
| Platform Fee | 5% | **0%** |
| Database | MongoDB | ✅ MongoDB |
| Escrow | Solana | ✅ Solana |
| Micropayments | x402 | ✅ x402 |
| Reputation | Soulbound | ✅ Soulbound |
| Setup | Complex | **Simple** |
| Dependencies | 20+ | **7** |

---

## 📜 License

MIT

---

**Built for the Agentic Web 🤖**
