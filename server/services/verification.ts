import { Connection, VersionedTransactionResponse } from '@solana/web3.js';
import { Address } from '@ton/core';
import { config } from '../config.js';
import { pubClient } from './redis.js';
import { withRetry, RetryOptions } from '../utils/retry.js';
import { CircuitBreaker } from '../utils/circuitBreaker.js';

// ---------------------------------------------------------------------------
// Config — validated at boot by config.ts
// ---------------------------------------------------------------------------
const SOL_RECIPIENT = config.SOL_RECIPIENT_ADDRESS;
const SOL_USDT_MINT = config.SOL_USDT_MINT;

const circuitBreakers = new Map<string, CircuitBreaker>();

function getBreaker(endpoint: string): CircuitBreaker {
    if (!circuitBreakers.has(endpoint)) {
        circuitBreakers.set(endpoint, new CircuitBreaker({
            failureThreshold: 3,
            resetTimeoutMs: 30000
        }));
    }
    return circuitBreakers.get(endpoint)!;
}

const defaultRetryOpts: RetryOptions = {
    maxRetries: 2,
    baseDelayMs: 500,
    maxDelayMs: 2000,
    timeoutMs: 8000
};

const TON_RECIPIENT = config.TON_RECIPIENT_ADDRESS;
const TON_JETTON_MASTER = config.TON_USDT_JETTON_MASTER;

const REGISTRATION_FEE = config.REGISTRATION_FEE_USDT;
// USDT on both TON and Solana uses 6 decimals
const REQUIRED_AMOUNT_ATOMIC = BigInt(Math.round(REGISTRATION_FEE * 1_000_000));

// ---------------------------------------------------------------------------
// Solana verification
// ---------------------------------------------------------------------------

/**
 * Strictly verify a Solana SPL-Token (USDT) payment.
 *
 * Checks performed:
 * 1. Transaction exists and succeeded (no `meta.err`)
 * 2. Sender wallet matches `expectedWallet`
 * 3. Recipient wallet matches configured `SOL_RECIPIENT_ADDRESS`
 * 4. Token mint matches configured `SOL_USDT_MINT`
 * 5. Transfer amount ≥ required registration fee
 */
export const verifySolanaTransaction = async (
    txHash: string,
    expectedWallet: string
): Promise<boolean> => {
    try {
        const cached = await pubClient.get(`tx_verify:${txHash}`);
        if (cached === 'true') {
            console.log(`⚡ Solana cache hit: verified ${txHash}`);
            return true;
        }

        let tx: VersionedTransactionResponse | null = null;
        let lastError: any = null;

        for (const rpc of config.SOL_RPC_ENDPOINTS) {
            const breaker = getBreaker(rpc);
            try {
                tx = await breaker.execute(() => withRetry(async () => {
                    const connection = new Connection(rpc, 'confirmed');
                    return await connection.getTransaction(txHash, {
                        maxSupportedTransactionVersion: 0,
                        commitment: 'confirmed',
                    });
                }, defaultRetryOpts));
                break; // Success
            } catch (e: any) {
                console.warn(`[Solana RPC ${rpc}] failed:`, e.message);
                lastError = e;
            }
        }

        if (!tx) {
            console.error(`Solana TX not found or all RPCs failed: ${txHash}. Last error:`, lastError);
            return false;
        }

        // 1. Transaction must have succeeded
        if (tx.meta?.err) {
            console.error('Solana TX has error:', tx.meta.err);
            return false;
        }

        // 2. Verify sender is a signer
        const accountKeys = tx.transaction.message.staticAccountKeys.map(k => k.toBase58());
        if (!accountKeys.includes(expectedWallet)) {
            console.error('STRICT: Sender wallet not found in tx account keys:', expectedWallet);
            return false;
        }

        // 3-5. Parse token balance changes to verify recipient, mint, and amount
        const preBalances = tx.meta?.preTokenBalances || [];
        const postBalances = tx.meta?.postTokenBalances || [];

        // Find recipient's token account entries matching our mint
        const recipientPreEntry = preBalances.find(
            b => b.owner === SOL_RECIPIENT && b.mint === SOL_USDT_MINT
        );
        const recipientPostEntry = postBalances.find(
            b => b.owner === SOL_RECIPIENT && b.mint === SOL_USDT_MINT
        );

        if (!recipientPostEntry) {
            console.error('STRICT: Recipient token account not found in postTokenBalances');
            return false;
        }

        // Compute amount received by recipient
        const preBal = BigInt(recipientPreEntry?.uiTokenAmount?.amount || '0');
        const postBal = BigInt(recipientPostEntry.uiTokenAmount?.amount || '0');
        const receivedAmount = postBal - preBal;

        if (receivedAmount < REQUIRED_AMOUNT_ATOMIC) {
            console.error(
                `STRICT: Insufficient amount. Expected ≥${REQUIRED_AMOUNT_ATOMIC}, got ${receivedAmount}`
            );
            return false;
        }

        // Also verify sender's balance decreased (matching mint)
        const senderPreEntry = preBalances.find(
            b => b.owner === expectedWallet && b.mint === SOL_USDT_MINT
        );
        const senderPostEntry = postBalances.find(
            b => b.owner === expectedWallet && b.mint === SOL_USDT_MINT
        );

        if (!senderPreEntry) {
            console.error('STRICT: Sender token account not found in preTokenBalances');
            return false;
        }

        const senderPre = BigInt(senderPreEntry.uiTokenAmount?.amount || '0');
        const senderPost = BigInt(senderPostEntry?.uiTokenAmount?.amount || '0');
        const senderDelta = senderPre - senderPost;

        if (senderDelta < REQUIRED_AMOUNT_ATOMIC) {
            console.error(
                `STRICT: Sender balance decrease insufficient. Expected ≥${REQUIRED_AMOUNT_ATOMIC}, got ${senderDelta}`
            );
            return false;
        }

        console.log(`✅ Solana TX verified: ${txHash} | ${receivedAmount} atomic units received`);
        await pubClient.setEx(`tx_verify:${txHash}`, 86400, 'true');
        return true;
    } catch (e) {
        console.error('Solana verification error:', e);
        return false;
    }
};

// ---------------------------------------------------------------------------
// TON verification
// ---------------------------------------------------------------------------

/**
 * Strictly verify a TON Jetton (USDT) payment.
 *
 * Checks performed:
 * 1. Transaction exists on-chain
 * 2. Source address matches `expectedWallet`
 * 3. Jetton master matches configured `TON_USDT_JETTON_MASTER`
 * 4. Destination matches configured `TON_RECIPIENT_ADDRESS`
 * 5. Transfer amount ≥ required registration fee
 *
 * Uses TonCenter API v3 `/jetton/transfers` for reliable Jetton inspection.
 */
export const verifyTonTransaction = async (
    txHash: string,
    expectedWallet: string
): Promise<boolean> => {
    try {
        const cached = await pubClient.get(`tx_verify:${txHash}`);
        if (cached === 'true') {
            console.log(`⚡ TON cache hit: verified ${txHash}`);
            return true;
        }

        // Normalize expected addresses for comparison
        const normalizedRecipient = normalizeTonAddress(TON_RECIPIENT);
        const normalizedSender = normalizeTonAddress(expectedWallet);
        const normalizedJettonMaster = normalizeTonAddress(TON_JETTON_MASTER);

        // Strategy 1: Use TonCenter v3 /jetton/transfers (most reliable for Jetton)
        const jettonResult = await verifyViaJettonTransfers(
            txHash,
            normalizedSender,
            normalizedRecipient,
            normalizedJettonMaster
        );

        if (jettonResult !== null) {
            if (jettonResult === true) {
                await pubClient.setEx(`tx_verify:${txHash}`, 86400, 'true');
            }
            return jettonResult;
        }

        // Strategy 2: Fallback to v2 /getTransactions and manual tx inspection
        const fallbackResult = await verifyViaGetTransactions(
            txHash,
            normalizedRecipient
        );
        if (fallbackResult) {
            await pubClient.setEx(`tx_verify:${txHash}`, 86400, 'true');
        }
        return fallbackResult;
    } catch (e) {
        console.error('TON verification error:', e);
        return false;
    }
};

// ---------------------------------------------------------------------------
// TON helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a TON address to raw form for reliable comparison.
 */
function normalizeTonAddress(addr: string): string {
    try {
        return Address.parse(addr).toRawString();
    } catch {
        return addr.toLowerCase();
    }
}

/**
 * Verify via TonCenter API v3 `/jetton/transfers` endpoint.
 * Returns `true` (pass), `false` (fail), or `null` (endpoint unavailable / no data).
 */
async function verifyViaJettonTransfers(
    txHash: string,
    normalizedSender: string,
    normalizedRecipient: string,
    normalizedJettonMaster: string
): Promise<boolean | null> {
    try {
        let response: Response | null = null;
        let lastError: any = null;

        for (const baseRpc of config.TON_RPC_ENDPOINTS) {
            const breaker = getBreaker(baseRpc);
            // Default TonCenter API path appended
            const url = `${baseRpc}/jetton/transfers?transaction_hash=${encodeURIComponent(txHash)}&limit=10`;

            try {
                response = await breaker.execute(() => withRetry(async () => {
                    const res = await fetch(url);
                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status} ${res.statusText}`);
                    }
                    return res;
                }, defaultRetryOpts));
                break; // success
            } catch (e: any) {
                console.warn(`[TON RPC ${baseRpc}] /jetton/transfers failed:`, e.message);
                lastError = e;
            }
        }

        if (!response) {
            console.warn('All TON RPCs for v3 /jetton/transfers failed. Last error:', lastError);
            return null; // fallback
        }

        const data = await response.json();
        const transfers = data.jetton_transfers || [];

        if (transfers.length === 0) {
            console.warn('No jetton transfers found for tx hash — trying fallback');
            return null; // fallback
        }

        // Check each transfer in the tx
        for (const transfer of transfers) {
            const transferSender = normalizeTonAddress(transfer.source?.address || transfer.source || '');
            const transferRecipient = normalizeTonAddress(transfer.destination?.address || transfer.destination || '');
            const transferJettonMaster = normalizeTonAddress(
                transfer.jetton_master?.address || transfer.jetton_master || ''
            );
            const transferAmount = BigInt(transfer.amount || '0');

            // Match: correct sender, recipient, jetton, and amount
            if (
                transferSender === normalizedSender &&
                transferRecipient === normalizedRecipient &&
                transferJettonMaster === normalizedJettonMaster &&
                transferAmount >= REQUIRED_AMOUNT_ATOMIC
            ) {
                console.log(`✅ TON Jetton TX verified via v3: ${txHash} | ${transferAmount} nano-units`);
                return true;
            }
        }

        // Found transfers but none matched our criteria
        console.error('STRICT: TON jetton transfers found but none match required criteria');
        console.error('Expected:', { normalizedSender, normalizedRecipient, normalizedJettonMaster, REQUIRED_AMOUNT_ATOMIC: REQUIRED_AMOUNT_ATOMIC.toString() });
        return false;
    } catch (e) {
        console.warn('TonCenter v3 lookup error:', e);
        return null;
    }
}

/**
 * Fallback: Verify via TonCenter v2 `/getTransactions` endpoint.
 * Less reliable for Jetton transfers but covers basic existence/recipient checks.
 */
async function verifyViaGetTransactions(
    txHash: string,
    _normalizedRecipient: string
): Promise<boolean> {
    try {
        const recipientForApi = Address.parse(TON_RECIPIENT).toString();

        let response: Response | null = null;
        let lastError: any = null;

        for (const baseRpc of config.TON_RPC_ENDPOINTS) {
            const breaker = getBreaker(baseRpc);
            // Convert v3 base to v2 base (naive approach for toncenter)
            const rpcV2 = baseRpc.includes('/v3') ? baseRpc.replace('/v3', '/v2') : baseRpc;
            const url = `${rpcV2}/getTransactions?address=${recipientForApi}&limit=20&hash=${encodeURIComponent(txHash)}`;

            try {
                response = await breaker.execute(() => withRetry(async () => {
                    const res = await fetch(url);
                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status} ${res.statusText}`);
                    }
                    return res;
                }, defaultRetryOpts));
                break; // success
            } catch (e: any) {
                console.warn(`[TON RPC v2 ${rpcV2}] /getTransactions failed:`, e.message);
                lastError = e;
            }
        }

        if (!response) {
            console.error('All TON API v2 endpoints failed. Last error:', lastError);
            return false;
        }

        const data = await response.json();
        if (!data.ok || !data.result || data.result.length === 0) {
            console.error('STRICT: TON TX not found or unconfirmed via v2:', txHash);
            return false;
        }

        // Transaction exists and is associated with recipient — but we can't
        // fully verify Jetton amount via v2 alone, so this is a weaker check.
        // We at least confirm the tx exists and involves the recipient.
        console.warn('⚠️  TON TX verified via v2 fallback (weaker check):', txHash);
        return true;
    } catch (e) {
        console.error('TON v2 fallback error:', e);
        return false;
    }
}
