import { 
    ActionGetResponse, 
    ActionPostRequest, 
    ActionPostResponse, 
    ACTIONS_CORS_HEADERS, 
    BLOCKCHAIN_IDS, 
} from "@solana/actions";
import { 
    Connection, 
    PublicKey, 
    LAMPORTS_PER_SOL, 
    SystemProgram, 
    TransactionMessage, 
    VersionedTransaction, 
    clusterApiUrl, 
} from "@solana/web3.js";

// The Solana wallet address for the Ghostagotchi where the SOL will be sent
const GHOST_WALLET_ADDRESS = "3a9PFxBxZU7kB8Sd95gud361t9LecuB54a1VrZjR6JnD"; 
// Use a reliable, public Mainnet-RPC with explicit 'confirmed' commitment
const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed'); 

// Standard headers for BLINKS
const HEADERS = {
    ...ACTIONS_CORS_HEADERS,
    // FIX: Replaced BLOCKCHAIN_IDS.Solana with the simple string 'solana' 
    // to resolve the TypeScript error 'Property 'Solana' does not exist'.
    "x-blockchain-ids": 'solana', 
    "x-action-version": "2.4",
};

// =================================================================
// 1. OPTIONS Endpoint (Required for CORS)
// =================================================================
export const OPTIONS = async () => {
    return new Response(null, { headers: HEADERS });
};

// =================================================================
// 2. GET Endpoint (Displays the BLINK UI metadata and buttons)
// =================================================================
export const GET = async (req: Request) => {
    // Get the base URL to correctly construct asset links
    const baseUrl = new URL("/", req.url).toString(); 

    const response: ActionGetResponse = {
        type: "action",
        // Use the absolute URL for the icon (assuming 'ghost_feed.png' is in 'public/')
        icon: `${baseUrl}ghost_feed.png`, 
        label: "Feed Ghost",
        title: "👻 Feed the Ghostagotchi (SOL)",
        description: "Support the Ghostagotchi by sending SOL. Nutrition is essential for its growth!",
        links: {
            actions: [
                {
                    type: "transaction",
                    label: "Small Snack (0.01 SOL)",
                    href: `/api/actions/feed-ghost?amount=0.01`,
                },
                {
                    type: "transaction",
                    label: "Mid-sized Meal (0.05 SOL)",
                    href: `/api/actions/feed-ghost?amount=0.05`,
                },
                {
                    // With custom input field
                    type: "transaction",
                    href: `/api/actions/feed-ghost?amount={amount}`,
                    label: "Custom Amount",
                    parameters: [
                        {
                            name: "amount",
                            label: "SOL Amount",
                            type: "number",
                        },
                    ],
                },
            ],
        },
    };

    return new Response(JSON.stringify(response), { status: 200, headers: HEADERS });
};

// =================================================================
// 3. POST Endpoint (Creates the transaction)
// =================================================================
export const POST = async (req: Request) => {
    try {
        // Step 1: Extract data
        const url = new URL(req.url);
        // Get the 'amount' from the query parameters
        const amount = Number(url.searchParams.get("amount")); 
        
        // The request body contains the payer's account
        const request: ActionPostRequest = await req.json();

        // Check for missing account before proceeding
        if (!request.account) {
             return new Response(JSON.stringify({ 
                 message: "Payer account missing in transaction request.", 
                 error: "PayerAccountMissing",
             }), { status: 400, headers: HEADERS });
        }

        const payer = new PublicKey(request.account);
        const receiver = new PublicKey(GHOST_WALLET_ADDRESS);

        if (amount <= 0 || isNaN(amount)) {
             // Return a structured error response
             return new Response(JSON.stringify({ 
                 message: "Please enter a valid amount.", 
                 error: "InvalidAmount",
             }), { status: 400, headers: HEADERS });
        }
        
        // Step 2: Prepare the transaction
        const transaction = await prepareTransferTransaction(
            connection,
            payer,
            receiver,
            amount
        );

        // Step 3: Return the serialized transaction
        const response: ActionPostResponse = { 
            type: 'transaction', 
            transaction: Buffer.from(transaction.serialize()).toString("base64"),
            message: `You fed the Ghost with ${amount} SOL! Thank you! 💖`, // Optional message after transaction
        };

        return Response.json(response, { status: 200, headers: HEADERS });
    } catch (error) {
        console.error("Error processing BLINK POST request:", error);
        // Return a structured error response
        return new Response(JSON.stringify({ 
            message: "Internal server error while creating transaction.", 
            error: "InternalServerError",
        }), { status: 500, headers: HEADERS });
    }
};

// =================================================================
// 4. Helper Function (Creates the Versioned Transaction)
// =================================================================
const prepareTransferTransaction = async (
    connection: Connection,
    payer: PublicKey,
    receiver: PublicKey,
    amount: number
) => {
    // 1. Create the instruction: SOL transfer
    const instruction = SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: receiver,
        lamports: amount * LAMPORTS_PER_SOL, // Convert SOL to Lamports
    });

    // 2. Fetch recent blockhash (with 'finalized' commitment)
    const { blockhash } = await connection.getLatestBlockhash({ commitment: 'finalized' });

    // 3. Build and compile the transaction
    const message = new TransactionMessage({
        payerKey: payer,
        recentBlockhash: blockhash,
        instructions: [instruction],
    }).compileToV0Message();

    return new VersionedTransaction(message);
};
