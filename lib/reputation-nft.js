/**
 * Reputation NFT (Soulbound)
 */
class ReputationNFT {
  constructor(config = {}) {
    this.symbol = 'AGREP';
  }

  calculateScore(agent) {
    const jobs = Math.min(agent.totalJobs || 0, 500) / 500 * 40;
    const earned = Math.min(agent.totalEarned || 0, 100000) / 100000 * 30;
    const rating = ((agent.reputation || 5) / 5) * 30;
    return Math.round(jobs + earned + rating);
  }

  getTier(score) {
    if (score >= 90) return { name: 'Diamond', color: '#b9f2ff' };
    if (score >= 70) return { name: 'Platinum', color: '#e5e4e2' };
    if (score >= 50) return { name: 'Gold', color: '#ffd700' };
    if (score >= 30) return { name: 'Silver', color: '#c0c0c0' };
    return { name: 'Bronze', color: '#cd7f32' };
  }

  router(getAgents) {
    const express = require('express');
    const router = express.Router();
    router.get('/reputation/:id', async (req, res) => {
      const agents = await getAgents();
      const agent = agents.find(a => a.id === req.params.id || a._id?.toString() === req.params.id);
      if (!agent) return res.status(404).json({ error: 'Agent not found' });
      const score = this.calculateScore(agent);
      const tier = this.getTier(score);
      res.json({ agent: agent.name, score, tier, totalJobs: agent.totalJobs, totalEarned: agent.totalEarned });
    });
    router.get('/leaderboard', async (req, res) => {
      const agents = await getAgents();
      const ranked = agents.map(a => ({ name: a.name, score: this.calculateScore(a), tier: this.getTier(this.calculateScore(a)).name })).sort((a, b) => b.score - a.score).slice(0, 20);
      res.json({ leaderboard: ranked });
    });
    return router;
  }
}
module.exports = { ReputationNFT };
