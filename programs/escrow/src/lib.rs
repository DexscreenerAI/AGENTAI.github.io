use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("EscrowXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

#[program]
pub mod escrow {
    use super::*;

    /// Create a new escrow for a task
    pub fn create_escrow(
        ctx: Context<CreateEscrow>,
        task_id: String,
        amount: u64,
        deadline: i64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        let clock = Clock::get()?;

        require!(amount > 0, EscrowError::InvalidAmount);
        require!(deadline > clock.unix_timestamp, EscrowError::InvalidDeadline);
        require!(task_id.len() <= 32, EscrowError::TaskIdTooLong);

        escrow.client = ctx.accounts.client.key();
        escrow.agent = Pubkey::default(); // Set when assigned
        escrow.task_id = task_id;
        escrow.amount = amount;
        escrow.deadline = deadline;
        escrow.status = EscrowStatus::Created;
        escrow.created_at = clock.unix_timestamp;
        escrow.bump = ctx.bumps.escrow;

        // Transfer USDC from client to escrow vault
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.client_token_account.to_account_info(),
                to: ctx.accounts.escrow_vault.to_account_info(),
                authority: ctx.accounts.client.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, amount)?;

        emit!(EscrowCreated {
            escrow: escrow.key(),
            client: escrow.client,
            task_id: escrow.task_id.clone(),
            amount,
        });

        Ok(())
    }

    /// Assign an agent to the escrow
    pub fn assign_agent(ctx: Context<AssignAgent>, agent: Pubkey) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        require!(escrow.status == EscrowStatus::Created, EscrowError::InvalidStatus);
        require!(agent != Pubkey::default(), EscrowError::InvalidAgent);

        escrow.agent = agent;
        escrow.status = EscrowStatus::Assigned;
        escrow.assigned_at = Some(Clock::get()?.unix_timestamp);

        emit!(AgentAssigned {
            escrow: escrow.key(),
            agent,
        });

        Ok(())
    }

    /// Client approves the work and releases funds to agent
    pub fn release_funds(ctx: Context<ReleaseFunds>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;

        require!(
            escrow.status == EscrowStatus::Assigned || escrow.status == EscrowStatus::Disputed,
            EscrowError::InvalidStatus
        );

        let amount = escrow.amount;
        let task_id = escrow.task_id.clone();

        // Transfer from vault to agent
        let seeds = &[
            b"escrow",
            task_id.as_bytes(),
            &[escrow.bump],
        ];
        let signer = &[&seeds[..]];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_vault.to_account_info(),
                to: ctx.accounts.agent_token_account.to_account_info(),
                authority: ctx.accounts.escrow.to_account_info(),
            },
            signer,
        );
        token::transfer(transfer_ctx, amount)?;

        // Update status
        let escrow = &mut ctx.accounts.escrow;
        escrow.status = EscrowStatus::Released;
        escrow.released_at = Some(Clock::get()?.unix_timestamp);

        emit!(FundsReleased {
            escrow: escrow.key(),
            agent: escrow.agent,
            amount,
        });

        Ok(())
    }

    /// Client requests a refund (before agent assigned or dispute won)
    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        let clock = Clock::get()?;

        // Can refund if: not assigned, or deadline passed, or dispute won
        let can_refund = escrow.status == EscrowStatus::Created
            || (escrow.status == EscrowStatus::Assigned && clock.unix_timestamp > escrow.deadline)
            || escrow.status == EscrowStatus::DisputeWonByClient;

        require!(can_refund, EscrowError::CannotRefund);

        let amount = escrow.amount;
        let task_id = escrow.task_id.clone();

        // Transfer from vault back to client
        let seeds = &[
            b"escrow",
            task_id.as_bytes(),
            &[escrow.bump],
        ];
        let signer = &[&seeds[..]];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_vault.to_account_info(),
                to: ctx.accounts.client_token_account.to_account_info(),
                authority: ctx.accounts.escrow.to_account_info(),
            },
            signer,
        );
        token::transfer(transfer_ctx, amount)?;

        // Update status
        let escrow = &mut ctx.accounts.escrow;
        escrow.status = EscrowStatus::Refunded;
        escrow.refunded_at = Some(clock.unix_timestamp);

        emit!(FundsRefunded {
            escrow: escrow.key(),
            client: escrow.client,
            amount,
        });

        Ok(())
    }

    /// Open a dispute
    pub fn open_dispute(ctx: Context<OpenDispute>, reason: String) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        require!(escrow.status == EscrowStatus::Assigned, EscrowError::InvalidStatus);
        require!(reason.len() <= 256, EscrowError::ReasonTooLong);

        escrow.status = EscrowStatus::Disputed;
        escrow.dispute_reason = Some(reason.clone());
        escrow.disputed_at = Some(Clock::get()?.unix_timestamp);

        emit!(DisputeOpened {
            escrow: escrow.key(),
            opener: ctx.accounts.opener.key(),
            reason,
        });

        Ok(())
    }

    /// Arbiter resolves dispute
    pub fn resolve_dispute(ctx: Context<ResolveDispute>, in_favor_of_client: bool) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        require!(escrow.status == EscrowStatus::Disputed, EscrowError::InvalidStatus);

        if in_favor_of_client {
            escrow.status = EscrowStatus::DisputeWonByClient;
        } else {
            escrow.status = EscrowStatus::DisputeWonByAgent;
        }

        escrow.resolved_at = Some(Clock::get()?.unix_timestamp);

        emit!(DisputeResolved {
            escrow: escrow.key(),
            in_favor_of_client,
        });

        Ok(())
    }
}

// ============================================
// ACCOUNTS
// ============================================

#[derive(Accounts)]
#[instruction(task_id: String)]
pub struct CreateEscrow<'info> {
    #[account(mut)]
    pub client: Signer<'info>,

    #[account(
        init,
        payer = client,
        space = 8 + Escrow::INIT_SPACE,
        seeds = [b"escrow", task_id.as_bytes()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        init,
        payer = client,
        token::mint = usdc_mint,
        token::authority = escrow,
        seeds = [b"vault", task_id.as_bytes()],
        bump
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub client_token_account: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, token::Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AssignAgent<'info> {
    #[account(
        mut,
        constraint = escrow.client == client.key() @ EscrowError::Unauthorized
    )]
    pub escrow: Account<'info, Escrow>,

    pub client: Signer<'info>,
}

#[derive(Accounts)]
pub struct ReleaseFunds<'info> {
    #[account(
        mut,
        constraint = escrow.client == client.key() @ EscrowError::Unauthorized
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        seeds = [b"vault", escrow.task_id.as_bytes()],
        bump
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = agent_token_account.owner == escrow.agent @ EscrowError::InvalidAgent
    )]
    pub agent_token_account: Account<'info, TokenAccount>,

    pub client: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(
        mut,
        constraint = escrow.client == client.key() @ EscrowError::Unauthorized
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        seeds = [b"vault", escrow.task_id.as_bytes()],
        bump
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub client_token_account: Account<'info, TokenAccount>,

    pub client: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct OpenDispute<'info> {
    #[account(
        mut,
        constraint = escrow.client == opener.key() || escrow.agent == opener.key() @ EscrowError::Unauthorized
    )]
    pub escrow: Account<'info, Escrow>,

    pub opener: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(
        mut,
        constraint = escrow.arbiter == Some(arbiter.key()) @ EscrowError::Unauthorized
    )]
    pub escrow: Account<'info, Escrow>,

    pub arbiter: Signer<'info>,
}

// ============================================
// STATE
// ============================================

#[account]
#[derive(InitSpace)]
pub struct Escrow {
    pub client: Pubkey,
    pub agent: Pubkey,
    #[max_len(32)]
    pub task_id: String,
    pub amount: u64,
    pub deadline: i64,
    pub status: EscrowStatus,
    pub created_at: i64,
    pub assigned_at: Option<i64>,
    pub released_at: Option<i64>,
    pub refunded_at: Option<i64>,
    pub disputed_at: Option<i64>,
    pub resolved_at: Option<i64>,
    #[max_len(256)]
    pub dispute_reason: Option<String>,
    pub arbiter: Option<Pubkey>,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum EscrowStatus {
    Created,
    Assigned,
    Released,
    Refunded,
    Disputed,
    DisputeWonByClient,
    DisputeWonByAgent,
}

// ============================================
// EVENTS
// ============================================

#[event]
pub struct EscrowCreated {
    pub escrow: Pubkey,
    pub client: Pubkey,
    pub task_id: String,
    pub amount: u64,
}

#[event]
pub struct AgentAssigned {
    pub escrow: Pubkey,
    pub agent: Pubkey,
}

#[event]
pub struct FundsReleased {
    pub escrow: Pubkey,
    pub agent: Pubkey,
    pub amount: u64,
}

#[event]
pub struct FundsRefunded {
    pub escrow: Pubkey,
    pub client: Pubkey,
    pub amount: u64,
}

#[event]
pub struct DisputeOpened {
    pub escrow: Pubkey,
    pub opener: Pubkey,
    pub reason: String,
}

#[event]
pub struct DisputeResolved {
    pub escrow: Pubkey,
    pub in_favor_of_client: bool,
}

// ============================================
// ERRORS
// ============================================

#[error_code]
pub enum EscrowError {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid deadline")]
    InvalidDeadline,
    #[msg("Task ID too long (max 32 chars)")]
    TaskIdTooLong,
    #[msg("Invalid escrow status for this operation")]
    InvalidStatus,
    #[msg("Invalid agent")]
    InvalidAgent,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Cannot refund at this time")]
    CannotRefund,
    #[msg("Reason too long (max 256 chars)")]
    ReasonTooLong,
}
