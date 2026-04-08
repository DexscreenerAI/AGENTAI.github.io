/**
 * Escrow Client - JavaScript SDK for Solana Escrow
 * 
 * Usage:
 *   const escrow = new EscrowClient(connection, wallet);
 *   await escrow.createEscrow(taskId, amount, deadline);
 *   await escrow.assignAgent(taskId, agentPubkey);
 *   await escrow.releaseFunds(taskId);
 */

const { 
  Connection, 
  PublicKey, 
  SystemProgram,
  Transaction,
  TransactionInstruction,
} = require('@solana/web3.js');
const { 
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} = require('@solana/spl-token');
const BN = require('bn.js');

// USDC Mint addresses
const USDC_MINT = {
  mainnet: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  devnet: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'), // Devnet USDC
};

// Program ID (replace with actual deployed program ID)
const ESCROW_PROGRAM_ID = new PublicKey('EscrowXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');

class EscrowClient {
  constructor(connection, wallet, network = 'devnet') {
    this.connection = connection;
    this.wallet = wallet;
    this.network = network;
    this.usdcMint = USDC_MINT[network] || USDC_MINT.devnet;
  }

  /**
   * Get PDA for escrow account
   */
  getEscrowPDA(taskId) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('escrow'), Buffer.from(taskId)],
      ESCROW_PROGRAM_ID
    );
  }

  /**
   * Get PDA for escrow vault
   */
  getVaultPDA(taskId) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), Buffer.from(taskId)],
      ESCROW_PROGRAM_ID
    );
  }

  /**
   * Create a new escrow
   * @param {string} taskId - Unique task identifier
   * @param {number} amount - Amount in USDC (will be converted to lamports)
   * @param {number} deadlineTimestamp - Unix timestamp for deadline
   */
  async createEscrow(taskId, amount, deadlineTimestamp) {
    const [escrowPDA, escrowBump] = this.getEscrowPDA(taskId);
    const [vaultPDA, vaultBump] = this.getVaultPDA(taskId);
    
    const clientTokenAccount = await getAssociatedTokenAddress(
      this.usdcMint,
      this.wallet.publicKey
    );

    // Amount in USDC decimals (6)
    const amountLamports = new BN(amount * 1_000_000);

    // Build instruction data
    const data = Buffer.concat([
      Buffer.from([0]), // Instruction index: create_escrow
      this.encodeString(taskId),
      amountLamports.toArrayLike(Buffer, 'le', 8),
      new BN(deadlineTimestamp).toArrayLike(Buffer, 'le', 8),
    ]);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: clientTokenAccount, isSigner: false, isWritable: true },
        { pubkey: this.usdcMint, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
      ],
      programId: ESCROW_PROGRAM_ID,
      data,
    });

    const tx = new Transaction().add(instruction);
    const signature = await this.sendTransaction(tx);

    return {
      signature,
      escrowPDA: escrowPDA.toBase58(),
      vaultPDA: vaultPDA.toBase58(),
    };
  }

  /**
   * Assign an agent to the escrow
   */
  async assignAgent(taskId, agentPubkey) {
    const [escrowPDA] = this.getEscrowPDA(taskId);

    const data = Buffer.concat([
      Buffer.from([1]), // Instruction index: assign_agent
      new PublicKey(agentPubkey).toBuffer(),
    ]);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
      ],
      programId: ESCROW_PROGRAM_ID,
      data,
    });

    const tx = new Transaction().add(instruction);
    return await this.sendTransaction(tx);
  }

  /**
   * Release funds to agent
   */
  async releaseFunds(taskId, agentPubkey) {
    const [escrowPDA] = this.getEscrowPDA(taskId);
    const [vaultPDA] = this.getVaultPDA(taskId);
    
    const agentTokenAccount = await getAssociatedTokenAddress(
      this.usdcMint,
      new PublicKey(agentPubkey)
    );

    const data = Buffer.from([2]); // Instruction index: release_funds

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: agentTokenAccount, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: ESCROW_PROGRAM_ID,
      data,
    });

    const tx = new Transaction().add(instruction);
    return await this.sendTransaction(tx);
  }

  /**
   * Request refund
   */
  async refund(taskId) {
    const [escrowPDA] = this.getEscrowPDA(taskId);
    const [vaultPDA] = this.getVaultPDA(taskId);
    
    const clientTokenAccount = await getAssociatedTokenAddress(
      this.usdcMint,
      this.wallet.publicKey
    );

    const data = Buffer.from([3]); // Instruction index: refund

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
        { pubkey: vaultPDA, isSigner: false, isWritable: true },
        { pubkey: clientTokenAccount, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: ESCROW_PROGRAM_ID,
      data,
    });

    const tx = new Transaction().add(instruction);
    return await this.sendTransaction(tx);
  }

  /**
   * Open a dispute
   */
  async openDispute(taskId, reason) {
    const [escrowPDA] = this.getEscrowPDA(taskId);

    const data = Buffer.concat([
      Buffer.from([4]), // Instruction index: open_dispute
      this.encodeString(reason),
    ]);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
      ],
      programId: ESCROW_PROGRAM_ID,
      data,
    });

    const tx = new Transaction().add(instruction);
    return await this.sendTransaction(tx);
  }

  /**
   * Get escrow account data
   */
  async getEscrow(taskId) {
    const [escrowPDA] = this.getEscrowPDA(taskId);
    
    try {
      const accountInfo = await this.connection.getAccountInfo(escrowPDA);
      if (!accountInfo) return null;

      // Parse account data (simplified - use Anchor's generated types in production)
      return {
        address: escrowPDA.toBase58(),
        exists: true,
        data: accountInfo.data,
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Get vault balance
   */
  async getVaultBalance(taskId) {
    const [vaultPDA] = this.getVaultPDA(taskId);
    
    try {
      const balance = await this.connection.getTokenAccountBalance(vaultPDA);
      return {
        address: vaultPDA.toBase58(),
        balance: balance.value.uiAmount,
        raw: balance.value.amount,
      };
    } catch (e) {
      return { balance: 0, raw: '0' };
    }
  }

  // Helpers
  encodeString(str) {
    const bytes = Buffer.from(str, 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32LE(bytes.length, 0);
    return Buffer.concat([len, bytes]);
  }

  async sendTransaction(tx) {
    tx.feePayer = this.wallet.publicKey;
    tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
    
    // Sign with wallet
    if (this.wallet.signTransaction) {
      const signed = await this.wallet.signTransaction(tx);
      const signature = await this.connection.sendRawTransaction(signed.serialize());
      await this.connection.confirmTransaction(signature, 'confirmed');
      return signature;
    } else {
      throw new Error('Wallet does not support signing');
    }
  }
}

module.exports = { EscrowClient, USDC_MINT, ESCROW_PROGRAM_ID };
