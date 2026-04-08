/**
 * PAYMENT VERIFIER
 * 
 * Vérifie les transactions USDC sur Solana AVANT de donner accès aux agents
 * 
 * Flow:
 * 1. Client envoie X-Payment header avec signature tx
 * 2. On vérifie la tx sur Solana RPC
 * 3. On vérifie: montant correct, recipient correct, confirmé
 * 4. Si OK → accès à l'agent
 */

const SOLANA_RPC = {
  'devnet': 'https://api.devnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
};

const USDC_MINT = {
  'devnet': '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  'mainnet-beta': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
};

// Cache pour éviter double-spend (tx déjà utilisée)
const usedTransactions = new Set();

/**
 * Vérifie une transaction Solana
 */
async function verifyTransaction(txSignature, expectedAmount, recipientWallet, network = 'devnet') {
  try {
    const rpc = SOLANA_RPC[network];
    
    // 1. Fetch transaction details
    const response = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [
          txSignature,
          { encoding: 'jsonParsed', commitment: 'confirmed' }
        ],
      }),
    });

    const data = await response.json();
    
    if (!data.result) {
      return { valid: false, error: 'Transaction not found or not confirmed' };
    }

    const tx = data.result;
    
    // 2. Check if transaction was successful
    if (tx.meta?.err) {
      return { valid: false, error: 'Transaction failed on-chain' };
    }

    // 3. Check if already used (prevent double-spend)
    if (usedTransactions.has(txSignature)) {
      return { valid: false, error: 'Transaction already used' };
    }

    // 4. Find USDC transfer in the transaction
    const instructions = tx.transaction?.message?.instructions || [];
    const innerInstructions = tx.meta?.innerInstructions || [];
    
    // Flatten all instructions
    const allInstructions = [
      ...instructions,
      ...innerInstructions.flatMap(i => i.instructions || []),
    ];

    // Look for SPL Token transfer
    let transferFound = false;
    let transferAmount = 0;
    let transferRecipient = null;

    for (const ix of allInstructions) {
      // Check for parsed SPL Token transfer
      if (ix.parsed?.type === 'transfer' || ix.parsed?.type === 'transferChecked') {
        const info = ix.parsed.info;
        transferAmount = parseFloat(info.amount || info.tokenAmount?.amount || 0);
        transferRecipient = info.destination;
        transferFound = true;
        break;
      }
    }

    // 5. Also check post-balances for token accounts
    const preBalances = tx.meta?.preTokenBalances || [];
    const postBalances = tx.meta?.postTokenBalances || [];
    
    // Find USDC balance changes
    for (const post of postBalances) {
      if (post.mint === USDC_MINT[network]) {
        const pre = preBalances.find(p => p.accountIndex === post.accountIndex);
        const preAmount = parseFloat(pre?.uiTokenAmount?.amount || '0');
        const postAmount = parseFloat(post.uiTokenAmount?.amount || '0');
        const diff = postAmount - preAmount;
        
        // If positive diff, this account received tokens
        if (diff > 0) {
          transferAmount = diff;
          transferRecipient = tx.transaction.message.accountKeys[post.accountIndex]?.pubkey;
          transferFound = true;
        }
      }
    }

    if (!transferFound) {
      return { valid: false, error: 'No USDC transfer found in transaction' };
    }

    // 6. Verify amount (USDC has 6 decimals)
    const expectedAmountRaw = expectedAmount * 1_000_000;
    if (transferAmount < expectedAmountRaw * 0.99) { // Allow 1% tolerance
      return { 
        valid: false, 
        error: `Insufficient amount. Expected ${expectedAmount} USDC, got ${transferAmount / 1_000_000}` 
      };
    }

    // 7. Mark transaction as used
    usedTransactions.add(txSignature);
    
    // Clean old transactions (keep last 10000)
    if (usedTransactions.size > 10000) {
      const arr = Array.from(usedTransactions);
      arr.slice(0, 5000).forEach(tx => usedTransactions.delete(tx));
    }

    return {
      valid: true,
      amount: transferAmount / 1_000_000,
      recipient: transferRecipient,
      signature: txSignature,
      slot: tx.slot,
      blockTime: tx.blockTime,
    };

  } catch (error) {
    console.error('Payment verification error:', error);
    return { valid: false, error: error.message };
  }
}

/**
 * Express middleware pour vérifier les paiements
 */
function paymentMiddleware(options = {}) {
  const { price, recipient, network = 'devnet', skipVerification = false } = options;

  return async (req, res, next) => {
    // Check for X-Payment header
    const paymentHeader = req.headers['x-payment'];
    
    if (!paymentHeader) {
      return res.status(402).json({
        error: 'Payment Required',
        price: price,
        currency: 'USDC',
        recipient: recipient,
        network: network,
        instructions: 'Send USDC payment, then include header: X-Payment: USDC:{amount}:{txSignature}:{yourWallet}',
      });
    }

    // Parse header: USDC:0.50:txSignature:walletPubkey
    const parts = paymentHeader.split(':');
    if (parts.length < 4 || parts[0] !== 'USDC') {
      return res.status(400).json({ 
        error: 'Invalid payment header format',
        expected: 'X-Payment: USDC:{amount}:{txSignature}:{walletPubkey}',
      });
    }

    const [, amount, txSignature, walletPubkey] = parts;

    // Skip verification for testing (remove in production!)
    if (skipVerification || process.env.SKIP_PAYMENT_VERIFICATION === 'true') {
      console.log(`[PAYMENT] Skipping verification for ${txSignature}`);
      req.payment = { verified: false, amount, txSignature, walletPubkey };
      return next();
    }

    // Verify the transaction
    const verification = await verifyTransaction(
      txSignature,
      price,
      recipient,
      network
    );

    if (!verification.valid) {
      return res.status(402).json({
        error: 'Payment verification failed',
        reason: verification.error,
        price: price,
        currency: 'USDC',
      });
    }

    // Payment verified!
    req.payment = {
      verified: true,
      amount: verification.amount,
      txSignature: txSignature,
      walletPubkey: walletPubkey,
      slot: verification.slot,
      blockTime: verification.blockTime,
    };

    console.log(`[PAYMENT] ✅ Verified ${verification.amount} USDC from ${walletPubkey}`);
    
    next();
  };
}

/**
 * Track revenue
 */
const revenueTracker = {
  total: 0,
  transactions: [],
  
  add(payment) {
    this.total += payment.amount;
    this.transactions.push({
      ...payment,
      timestamp: new Date().toISOString(),
    });
    
    // Keep last 1000 transactions
    if (this.transactions.length > 1000) {
      this.transactions = this.transactions.slice(-1000);
    }
  },
  
  getStats() {
    return {
      totalRevenue: this.total,
      transactionCount: this.transactions.length,
      recentTransactions: this.transactions.slice(-10),
    };
  },
};

module.exports = {
  verifyTransaction,
  paymentMiddleware,
  revenueTracker,
  USDC_MINT,
  SOLANA_RPC,
};
