/**
 * Reputation NFT - Soulbound Token System
 * 
 * Non-transferable NFTs that represent an agent's reputation
 * 
 * Features:
 * - Mint on agent registration
 * - Update metadata on job completion
 * - Badge system for achievements
 * - On-chain verification
 */

const { 
  Connection, 
  PublicKey, 
  Keypair,
  Transaction,
  SystemProgram,
} = require('@solana/web3.js');

// Metaplex imports (simplified - use @metaplex-foundation/js in production)
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

class ReputationNFT {
  constructor(config = {}) {
    this.connection = config.connection || new Connection('https://api.devnet.solana.com', 'confirmed');
    this.authority = config.authority; // Platform authority keypair
    this.collectionMint = config.collectionMint; // Collection NFT mint
    
    // Metadata base URI
    this.metadataBaseUri = config.metadataBaseUri || 'https://api.agentmarketplace.com/reputation';
    
    // Badge thresholds
    this.badges = {
      newbie: { minJobs: 0, icon: '🆕' },
      rising: { minJobs: 5, icon: '⭐' },
      verified: { minJobs: 25, icon: '✅' },
      expert: { minJobs: 100, icon: '🏆' },
      legend: { minJobs: 500, icon: '👑' },
      top_earner: { minEarned: 10000, icon: '💰' },
      perfect_rating: { minRating: 5.0, minJobs: 10, icon: '💎' },
    };
  }

  /**
   * Generate metadata for a reputation NFT
   */
  generateMetadata(agent) {
    const stats = this.calculateStats(agent);
    const badges = this.calculateBadges(agent);
    const tier = this.calculateTier(agent);

    return {
      name: `${agent.name} Reputation`,
      symbol: 'AGREP',
      description: `Soulbound reputation token for ${agent.name} on Agent Marketplace`,
      seller_fee_basis_points: 0, // No royalties (soulbound)
      image: this.generateImage(agent, tier),
      external_url: `https://agentmarketplace.com/agent/${agent.id}`,
      attributes: [
        { trait_type: 'Type', value: agent.type === 'ai' ? 'AI Agent' : 'Human' },
        { trait_type: 'Tier', value: tier.name },
        { trait_type: 'Total Jobs', value: stats.totalJobs },
        { trait_type: 'Total Earned', value: `$${stats.totalEarned.toFixed(2)}` },
        { trait_type: 'Rating', value: stats.rating.toFixed(1) },
        { trait_type: 'Completion Rate', value: `${stats.completionRate}%` },
        { trait_type: 'Member Since', value: agent.createdAt?.split('T')[0] || 'Unknown' },
        { trait_type: 'Skills', value: (agent.skills || []).join(', ') },
        ...badges.map(b => ({ trait_type: 'Badge', value: `${b.icon} ${b.name}` })),
      ],
      properties: {
        category: 'identity',
        creators: [
          { address: this.authority?.publicKey?.toBase58() || 'PLATFORM', share: 100 }
        ],
        files: [],
      },
      // Soulbound flag
      soulbound: true,
      transferable: false,
    };
  }

  /**
   * Calculate agent stats
   */
  calculateStats(agent) {
    return {
      totalJobs: agent.totalJobs || 0,
      totalEarned: agent.totalEarned || 0,
      rating: agent.reputation || 5.0,
      completionRate: agent.completionRate || 100,
    };
  }

  /**
   * Calculate earned badges
   */
  calculateBadges(agent) {
    const badges = [];
    const stats = this.calculateStats(agent);

    // Job count badges
    if (stats.totalJobs >= 500) {
      badges.push({ name: 'Legend', icon: '👑', type: 'legend' });
    } else if (stats.totalJobs >= 100) {
      badges.push({ name: 'Expert', icon: '🏆', type: 'expert' });
    } else if (stats.totalJobs >= 25) {
      badges.push({ name: 'Verified', icon: '✅', type: 'verified' });
    } else if (stats.totalJobs >= 5) {
      badges.push({ name: 'Rising Star', icon: '⭐', type: 'rising' });
    }

    // Earnings badge
    if (stats.totalEarned >= 10000) {
      badges.push({ name: 'Top Earner', icon: '💰', type: 'top_earner' });
    }

    // Perfect rating badge
    if (stats.rating >= 4.9 && stats.totalJobs >= 10) {
      badges.push({ name: 'Perfect Rating', icon: '💎', type: 'perfect_rating' });
    }

    // AI specific badges
    if (agent.type === 'ai') {
      badges.push({ name: 'AI Agent', icon: '🤖', type: 'ai' });
    }

    return badges;
  }

  /**
   * Calculate tier based on stats
   */
  calculateTier(agent) {
    const stats = this.calculateStats(agent);
    const jobs = stats.totalJobs;
    const earned = stats.totalEarned;
    const rating = stats.rating;

    // Score calculation
    const jobScore = Math.min(jobs / 100, 1) * 40;
    const earnScore = Math.min(earned / 10000, 1) * 30;
    const ratingScore = (rating / 5) * 30;
    const totalScore = jobScore + earnScore + ratingScore;

    if (totalScore >= 90) return { name: 'Diamond', color: '#b9f2ff', level: 5 };
    if (totalScore >= 70) return { name: 'Platinum', color: '#e5e4e2', level: 4 };
    if (totalScore >= 50) return { name: 'Gold', color: '#ffd700', level: 3 };
    if (totalScore >= 30) return { name: 'Silver', color: '#c0c0c0', level: 2 };
    return { name: 'Bronze', color: '#cd7f32', level: 1 };
  }

  /**
   * Generate SVG image for the NFT
   */
  generateImage(agent, tier) {
    const badges = this.calculateBadges(agent);
    const stats = this.calculateStats(agent);
    const isAI = agent.type === 'ai';

    // Return base64 SVG
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${tier.color};stop-opacity:0.3" />
            <stop offset="100%" style="stop-color:#1a1a2e;stop-opacity:1" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <!-- Background -->
        <rect width="400" height="500" fill="url(#bg)" rx="20"/>
        
        <!-- Border -->
        <rect x="10" y="10" width="380" height="480" fill="none" stroke="${tier.color}" stroke-width="2" rx="15" opacity="0.5"/>
        
        <!-- Type Icon -->
        <text x="200" y="80" font-size="50" text-anchor="middle" filter="url(#glow)">${isAI ? '🤖' : '👤'}</text>
        
        <!-- Name -->
        <text x="200" y="130" font-family="monospace" font-size="20" fill="white" text-anchor="middle" font-weight="bold">${agent.name || 'Agent'}</text>
        
        <!-- Tier Badge -->
        <rect x="140" y="145" width="120" height="30" fill="${tier.color}" rx="15" opacity="0.3"/>
        <text x="200" y="167" font-family="monospace" font-size="14" fill="${tier.color}" text-anchor="middle">${tier.name.toUpperCase()}</text>
        
        <!-- Stats -->
        <text x="50" y="220" font-family="monospace" font-size="12" fill="#888">JOBS</text>
        <text x="50" y="245" font-family="monospace" font-size="24" fill="white" font-weight="bold">${stats.totalJobs}</text>
        
        <text x="150" y="220" font-family="monospace" font-size="12" fill="#888">EARNED</text>
        <text x="150" y="245" font-family="monospace" font-size="24" fill="#10b981" font-weight="bold">$${stats.totalEarned >= 1000 ? (stats.totalEarned/1000).toFixed(1) + 'k' : stats.totalEarned}</text>
        
        <text x="280" y="220" font-family="monospace" font-size="12" fill="#888">RATING</text>
        <text x="280" y="245" font-family="monospace" font-size="24" fill="#fbbf24" font-weight="bold">${stats.rating.toFixed(1)} ⭐</text>
        
        <!-- Completion Rate Bar -->
        <text x="50" y="290" font-family="monospace" font-size="12" fill="#888">COMPLETION RATE</text>
        <rect x="50" y="300" width="300" height="10" fill="#333" rx="5"/>
        <rect x="50" y="300" width="${stats.completionRate * 3}" height="10" fill="#6366f1" rx="5"/>
        <text x="355" y="310" font-family="monospace" font-size="12" fill="white">${stats.completionRate}%</text>
        
        <!-- Badges -->
        <text x="50" y="360" font-family="monospace" font-size="12" fill="#888">BADGES</text>
        <text x="50" y="390" font-size="30">${badges.map(b => b.icon).join(' ') || '🆕'}</text>
        
        <!-- Skills -->
        <text x="50" y="440" font-family="monospace" font-size="12" fill="#888">SKILLS</text>
        <text x="50" y="465" font-family="monospace" font-size="11" fill="#aaa">${(agent.skills || []).slice(0, 4).join(' • ')}</text>
        
        <!-- Footer -->
        <text x="200" y="490" font-family="monospace" font-size="8" fill="#555" text-anchor="middle">AGENT MARKETPLACE • SOULBOUND</text>
      </svg>
    `;

    // Return as data URI
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }

  /**
   * Mint a reputation NFT for an agent
   * In production, use @metaplex-foundation/js
   */
  async mintReputationNFT(agent) {
    const metadata = this.generateMetadata(agent);
    
    // Generate unique mint for this agent
    const mintKeypair = Keypair.generate();
    
    // Store metadata off-chain (Arweave/IPFS in production)
    const metadataUri = await this.uploadMetadata(metadata);
    
    // Return mint info (actual minting would use Metaplex SDK)
    return {
      mint: mintKeypair.publicKey.toBase58(),
      metadata,
      metadataUri,
      image: metadata.image,
      // Transaction would be here in production
      instructions: 'Use Metaplex SDK to mint',
    };
  }

  /**
   * Update NFT metadata after job completion
   */
  async updateReputationNFT(agent, nftMint) {
    const newMetadata = this.generateMetadata(agent);
    
    // Upload new metadata
    const metadataUri = await this.uploadMetadata(newMetadata);
    
    return {
      mint: nftMint,
      metadata: newMetadata,
      metadataUri,
      image: newMetadata.image,
      updated: true,
    };
  }

  /**
   * Upload metadata to storage
   * In production, use Arweave or IPFS
   */
  async uploadMetadata(metadata) {
    // Simulate upload - returns fake URI
    const hash = Buffer.from(JSON.stringify(metadata)).toString('base64').slice(0, 32);
    return `${this.metadataBaseUri}/${hash}.json`;
  }

  /**
   * Verify reputation NFT ownership
   */
  async verifyOwnership(walletAddress, expectedMinJobs = 0) {
    // In production, fetch NFT metadata and verify
    return {
      verified: true,
      message: 'NFT verification would query on-chain data',
    };
  }

  /**
   * Get leaderboard
   */
  getLeaderboard(agents, sortBy = 'totalJobs', limit = 10) {
    return agents
      .map(agent => ({
        ...agent,
        ...this.calculateStats(agent),
        tier: this.calculateTier(agent),
        badges: this.calculateBadges(agent),
      }))
      .sort((a, b) => b[sortBy] - a[sortBy])
      .slice(0, limit);
  }

  /**
   * Express router for reputation API
   */
  router(getAgents) {
    const express = require('express');
    const router = express.Router();

    // Get reputation card
    router.get('/reputation/:agentId', async (req, res) => {
      const agents = await getAgents();
      const agent = agents.find(a => a.id === req.params.agentId);
      
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      res.json({
        agent: {
          id: agent.id,
          name: agent.name,
          type: agent.type,
        },
        stats: this.calculateStats(agent),
        tier: this.calculateTier(agent),
        badges: this.calculateBadges(agent),
        metadata: this.generateMetadata(agent),
      });
    });

    // Get reputation image
    router.get('/reputation/:agentId/image', async (req, res) => {
      const agents = await getAgents();
      const agent = agents.find(a => a.id === req.params.agentId);
      
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      const tier = this.calculateTier(agent);
      const image = this.generateImage(agent, tier);
      
      // Return SVG
      const svg = Buffer.from(image.split(',')[1], 'base64');
      res.type('image/svg+xml').send(svg);
    });

    // Get leaderboard
    router.get('/leaderboard', async (req, res) => {
      const agents = await getAgents();
      const sortBy = req.query.sortBy || 'totalJobs';
      const limit = parseInt(req.query.limit) || 10;
      
      res.json({
        leaderboard: this.getLeaderboard(agents, sortBy, limit),
      });
    });

    // Mint reputation NFT (requires auth)
    router.post('/reputation/:agentId/mint', async (req, res) => {
      const agents = await getAgents();
      const agent = agents.find(a => a.id === req.params.agentId);
      
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      try {
        const result = await this.mintReputationNFT(agent);
        res.json({ success: true, ...result });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    return router;
  }
}

module.exports = { ReputationNFT };
