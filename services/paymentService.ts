import { beginCell, Address, Cell } from '@ton/core';
import type { TonConnectUI } from '@tonconnect/ui-react';
import {
    Connection,
    PublicKey,
    Transaction,
    TransactionInstruction,
} from '@solana/web3.js';
import {
    createTransferInstruction,
    getAssociatedTokenAddress,
    TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import type { WalletContextState } from '@solana/wallet-adapter-react';
import {
    TON_USDT_JETTON_MASTER,
    TON_RECIPIENT_ADDRESS,
    SOL_USDT_MINT,
    SOL_RECIPIENT_ADDRESS,
} from '../constants';

// ─── TON USDT (Jetton) Transfer ───────────────────────────────────

/**
 * Sends a Jetton (USDT) transfer on TON via TON Connect.
 * Returns the BOC (transaction hash) on success.
 *
 * USDT on TON has 6 decimals.
 */
export async function sendTonUSDT(
    tonConnectUI: TonConnectUI,
    amountUSDT: number,
    comment?: string
): Promise<string> {
    if (!TON_RECIPIENT_ADDRESS || !TON_USDT_JETTON_MASTER) {
        throw new Error('TON payment configuration missing. Check .env file.');
    }

    const amountNano = BigInt(Math.round(amountUSDT * 1_000_000)); // 6 decimals

    // Build the comment payload (forward_payload)
    // Standard text comment: 32-bit 0 + string
    let forwardPayload = null;
    if (comment) {
        forwardPayload = beginCell()
            .storeUint(0, 32)
            .storeStringTail(comment)
            .endCell();
    }

    // Jetton transfer payload:
    // op::transfer = 0xf8a7ea5
    // query_id: uint64 = 0
    // amount: coins = amountNano
    // destination: address = TON_RECIPIENT_ADDRESS
    // response_destination: address = sender (empty/user)
    // custom_payload: maybe = null
    // forward_ton_amount: coins = 0.01 TON (for notification)
    // forward_payload: either = comment (if any)

    const body = buildJettonTransferBody(amountNano, TON_RECIPIENT_ADDRESS, forwardPayload);

    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600, // 10 min
        messages: [
            {
                // Send to the user's Jetton wallet — the wallet app resolves this
                // We use a known pattern: send to Jetton master with transfer body
                address: TON_USDT_JETTON_MASTER,
                amount: '50000000', // 0.05 TON for gas
                payload: body,
            },
        ],
    };

    const result = await tonConnectUI.sendTransaction(transaction);
    if (result?.boc) {
        try {
            const bocCell = Cell.fromBase64(result.boc);
            return bocCell.hash().toString('hex');
        } catch {
            return result.boc;
        }
    }

    throw new Error('TON wallet did not return a transaction payload');
}

/**
 * Builds a Jetton transfer cell body as a base64 string.
 * This is the TL-B structure for jetton::transfer.
 */
function buildJettonTransferBody(
    amountNano: bigint,
    recipientAddress: string,
    forwardPayload: any // effective type is Cell | null
): string {
    const destinationAddress = Address.parse(recipientAddress);

    const cellBuilder = beginCell()
        .storeUint(0xf8a7ea5, 32) // opcode: transfer
        .storeUint(0, 64) // query_id
        .storeCoins(amountNano) // amount
        .storeAddress(destinationAddress) // destination
        .storeAddress(null) // response_destination
        .storeMaybeRef(null) // custom_payload
        .storeCoins(1n); // forward_ton_amount

    // forward_payload is valid `Either Cell ^Cell`
    // We will store it as a reference if it exists to be safe and clean,
    // or typically for small comments inline is fine but `storeMaybeRef` is good for "Maybe ^Cell"
    // The TL-B for `forward_payload` is `Either Cell ^Cell`.
    // If we want to be simple, we can just store the bit if it's null.
    // If not null, we decide whether to store inline or ref.
    // For simplicity with `beginCell`, let's assume `forwardPayload` is the cell containing the comment data.

    if (forwardPayload) {
        // Store as a reference (Either.Right)
        cellBuilder.storeBit(1).storeRef(forwardPayload);
    } else {
        // Store as inline (Either.Left) - empty slice
        cellBuilder.storeBit(0);
    }

    return cellBuilder.endCell().toBoc().toString('base64');
}

// ─── Solana USDT (SPL Token) Transfer ─────────────────────────────

/**
 * Sends an SPL USDT transfer on Solana via wallet adapter.
 * Returns the transaction signature on success.
 *
 * USDT on Solana has 6 decimals.
 */
export async function sendSolanaUSDT(
    connection: Connection,
    wallet: WalletContextState,
    amountUSDT: number,
    comment?: string,
    onStatusChange?: (status: 'CONFIRMING_TX') => void
): Promise<string> {
    if (!SOL_RECIPIENT_ADDRESS || !SOL_USDT_MINT) {
        throw new Error('Solana payment configuration missing. Check .env file.');
    }

    if (!wallet.publicKey || !wallet.sendTransaction) {
        throw new Error('Solana wallet not connected.');
    }

    const mintPubkey = new PublicKey(SOL_USDT_MINT);
    const recipientPubkey = new PublicKey(SOL_RECIPIENT_ADDRESS);
    const senderPubkey = wallet.publicKey;

    // Amount with 6 decimals
    const amountLamports = Math.round(amountUSDT * 1_000_000);

    // Get Associated Token Accounts
    const senderATA = await getAssociatedTokenAddress(mintPubkey, senderPubkey);
    const recipientATA = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

    const transaction = new Transaction();

    // 1. Create SPL transfer instruction
    const transferIx = createTransferInstruction(
        senderATA,
        recipientATA,
        senderPubkey,
        amountLamports,
        [],
        TOKEN_PROGRAM_ID
    );
    transaction.add(transferIx);

    // 2. Add Memo (Comment) if provided
    if (comment) {
        const memoProgramId = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcQb');
        const memoIx = new TransactionInstruction({
            keys: [{ pubkey: senderPubkey, isSigner: true, isWritable: false }],
            programId: memoProgramId,
            data: Buffer.from(comment, 'utf-8'),
        });
        transaction.add(memoIx);
    }

    transaction.feePayer = senderPubkey;

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    const signature = await wallet.sendTransaction(transaction, connection);

    // Transition state immediately after wallet signature resolves
    if (onStatusChange) {
        onStatusChange('CONFIRMING_TX');
    }

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');

    return signature;
}
