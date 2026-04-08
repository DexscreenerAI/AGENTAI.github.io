/**
 * Solana Escrow Client
 */
class EscrowClient {
  constructor(config = {}) {
    this.programId = config.programId || 'EscrowXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    this.network = config.network || 'devnet';
  }
  async createEscrow(taskId, amount, deadline) {
    return { taskId, amount, deadline, status: 'created', pda: `escrow_${taskId}` };
  }
  async releaseFunds(taskId) {
    return { taskId, status: 'released' };
  }
  async refund(taskId) {
    return { taskId, status: 'refunded' };
  }
}
module.exports = { EscrowClient };
