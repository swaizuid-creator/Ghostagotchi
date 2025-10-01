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
} from "@solana/web3.js";

// Het Solana-adres van de Ghostagotchi waar de SOL naartoe gaat
const GHOST_WALLET_ADDRESS = "3a9PFxBxZU7kB8Sd95gud361t9LecuB54a1VrZjR6JnD"; 
const connection = new Connection("https://api.mainnet-beta.solana.com"); // Gebruik Mainnet RPC of een Devnet/Testnet RPC voor testen

// Standaard headers voor BLINKS
const HEADERS = {
    ...ACTIONS_CORS_HEADERS,
    "x-blockchain-ids": BLOCKCHAIN_IDS.SolanaMainnet, // Gebruik SolanaMainnet of SolanaDevnet
    "x-action-version": "2.4",
};

// =================================================================
// 1. OPTIONS Endpoint (Vereist voor CORS)
// =================================================================
export const OPTIONS = async () => {
    return new Response(null, { headers: HEADERS });
};

// =================================================================
// 2. GET Endpoint (Toont de BLINK UI metadata en knoppen)
// =================================================================
export const GET = async (req: Request) => {
    const response: ActionGetResponse = {
        type: "action",
        // Gebruik de URL van uw gehoste sprite als icon (pas deze aan!)
        icon: `${new URL("/ghost_feed.png", req.url).toString()}`,
        label: "Feed Ghost",
        title: "👻 Voed de Ghostagotchi (SOL)",
        description: "Steun de Ghostagotchi door SOL te sturen. Voeding is essentieel voor zijn groei!",
        links: {
            actions: [
                {
                    type: "transaction",
                    label: "Klein hapje (0.01 SOL)",
                    href: `/api/actions/feed-ghost?amount=0.01`,
                },
                {
                    type: "transaction",
                    label: "Midden maaltijd (0.05 SOL)",
                    href: `/api/actions/feed-ghost?amount=0.05`,
                },
                {
                    // Met custom invoerveld
                    type: "transaction",
                    href: `/api/actions/feed-ghost?amount={amount}`,
                    label: "Aangepast bedrag",
                    parameters: [
                        {
                            name: "amount",
                            label: "SOL bedrag",
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
// 3. POST Endpoint (Maakt de transactie aan)
// =================================================================
export const POST = async (req: Request) => {
    try {
        // Stap 1: Gegevens extraheren
        const url = new URL(req.url);
        const amount = Number(url.searchParams.get("amount"));
        const request: ActionPostRequest = await req.json();
        const payer = new PublicKey(request.account);
        const receiver = new PublicKey(GHOST_WALLET_ADDRESS);

        if (amount <= 0 || isNaN(amount)) {
             return new Response(JSON.stringify({ message: "Voer een geldig bedrag in." }), { status: 400, headers: HEADERS });
        }
        
        // Stap 2: Transactie voorbereiden
        const transaction = await prepareTransferTransaction(
            connection,
            payer,
            receiver,
            amount
        );

        // Stap 3: Geef de geserialiseerde transactie terug
        const response: ActionPostResponse = {
            transaction: Buffer.from(transaction.serialize()).toString("base64"),
            message: `Je hebt de Ghost gevoed met ${amount} SOL! Dankjewel! 💖`, // Optioneel bericht na transactie
        };

        return Response.json(response, { status: 200, headers: HEADERS });
    } catch (error) {
        console.error("Fout bij verwerken BLINK POST request:", error);
        return new Response(JSON.stringify({ error: "Interne serverfout bij aanmaken transactie." }), { status: 500, headers: HEADERS });
    }
};

// =================================================================
// 4. Helper Functie (Creëert de Versioned Transaction)
// =================================================================
const prepareTransferTransaction = async (
    connection: Connection,
    payer: PublicKey,
    receiver: PublicKey,
    amount: number
) => {
    // 1. Maak de instructie aan: SOL overdracht
    const instruction = SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: receiver,
        lamports: amount * LAMPORTS_PER_SOL, // Converteer SOL naar Lamports
    });

    // 2. Haal recente blockhash op
    const { blockhash } = await connection.getLatestBlockhash();

    // 3. Bouw en compileer de transactie
    const message = new TransactionMessage({
        payerKey: payer,
        recentBlockhash: blockhash,
        instructions: [instruction],
    }).compileToV0Message();

    return new VersionedTransaction(message);
};