import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Allow CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { address } = req.body || {};

    if (!address) {
        return res.status(400).json({ error: 'Address is required' });
    }

    if (!ADMIN_SECRET_KEY) {
        console.error('ADMIN_SECRET_KEY is not set');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        // Decode the private key (supports 'suiprivkey...' format)
        const { schema, secretKey } = decodeSuiPrivateKey(ADMIN_SECRET_KEY);
        if (schema !== 'ED25519') {
            throw new Error('Only ED25519 keys are supported for now');
        }
        const keypair = Ed25519Keypair.fromSecretKey(secretKey);

        const client = new SuiClient({ url: getFullnodeUrl('testnet') });

        const tx = new Transaction();
        // Split 0.05 SUI (50,000,000 MIST) from gas
        const [coin] = tx.splitCoins(tx.gas, [50000000]);
        // Transfer to user
        tx.transferObjects([coin], address);

        const result = await client.signAndExecuteTransaction({
            signer: keypair,
            transaction: tx,
        });

        return res.status(200).json({ success: true, digest: result.digest });

    } catch (error: any) {
        console.error('Faucet error:', error);
        return res.status(500).json({ error: error.message || 'Faucet failed' });
    }
}
