import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import axios from "axios"; // 🔹 Required for 1Inch API
import { initializeAgent } from "./backend";
import { ethers } from "ethers";


import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const ONE_INCH_API_URL = "https://api.1inch.dev/swap/v5.2/84532"; // 84532 = Base Sepolia Chain ID
const API_BASE_URL = "http://localhost:3000"; // ✅ Ensure it matches backend


app.use(cors());
app.use(express.json());

// Global variables for agent and config
let agent: any;
let config: any;

/**
 * Initialize the agent and handle errors gracefully
 */
async function initAgent() {
    try {
        console.log("🔄 Initializing Agent...");
        const result = await initializeAgent();
        agent = result.agent;
        config = result.config;
        console.log("✅ Agent initialized successfully.");
    } catch (error) {
        console.error("❌ Failed to initialize agent:", error);
        process.exit(1);
    }
}

// Ensure agent is initialized before handling requests
initAgent();

/**
 * Middleware to ensure the agent is initialized before processing requests.
 */
function ensureAgentReady(req: Request, res: Response, next: NextFunction): void {
    if (!agent) {
        console.warn("⚠️ Agent not ready. Retrying...");
        res.status(503).json({ error: "Agent is initializing. Please try again later." });
    } else {
        next();
    }
}

/**
 * Call a smart contract function
 */
app.post("/api/contract/call", ensureAgentReady, async (req: Request, res: Response): Promise<void> => {
    try {
        const { contractAddress, abi, functionName, args, isWrite } = req.body;

        if (!contractAddress || !abi || !functionName) {
            res.status(400).json({ error: "Missing contractAddress, abi, or functionName" });
            return;
        }

        console.log(`📡 Calling contract function ${functionName} on ${contractAddress}`);

        const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
        const contract = new ethers.Contract(contractAddress, abi, wallet);

        let result;
        if (isWrite) {
            // Write (send) transaction
            const tx = await contract[functionName](...args);
            result = await tx.wait();
        } else {
            // Read (call) function
            result = await contract[functionName](...args);
        }

        res.json({ success: true, result });
    } catch (error: any) {
        console.error("❌ Contract Call Error:", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
});
/**
 * Fetch a swap quote from 1Inch API
 */
app.get("/api/swap/quote", ensureAgentReady, async (req: Request, res: Response): Promise<void> => {
    try {
        const { fromToken, toToken, amount, slippage } = req.query;

        if (!fromToken || !toToken || !amount) {
            res.status(400).json({ error: "Missing required parameters: fromToken, toToken, amount" });
            return;
        }

        const response = await axios.get(`${ONE_INCH_API_URL}/quote`, {
            params: {
                fromTokenAddress: fromToken,
                toTokenAddress: toToken,
                amount,
                slippage: slippage || 1,
            },
            headers: { Authorization: `Bearer ${process.env.ONE_INCH_API_KEY}` },
        });

        res.json(response.data);
    } catch (error: any) {
        console.error("❌ Swap Quote Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to fetch swap quote" });
    }
});

/**
 * Execute a swap on 1Inch
 */
app.post("/api/swap", ensureAgentReady, async (req: Request, res: Response) => {
    try {
        const { fromToken, toToken, amount, walletAddress } = req.body;

        if (!fromToken || !toToken || !amount || !walletAddress) {
            res.status(400).json({ error: "Missing required parameters: fromToken, toToken, amount, walletAddress" });
            return;
        }

        console.log(`🔄 Requesting swap for ${amount} ${fromToken} → ${toToken} from ${walletAddress}...`);

        // ✅ Fetch a swap quote from 1Inch API
        const response = await axios.get(`${ONE_INCH_API_URL}/quote`, {
            params: {
                fromTokenAddress: fromToken,
                toTokenAddress: toToken,
                amount,
                walletAddress,
                slippage: 1, // Adjust slippage as needed
            },
            headers: { Authorization: `Bearer ${process.env.ONE_INCH_API_KEY}` },
        });

        console.log(`🔹 Swap Quote Received: ${JSON.stringify(response.data)}`);
        res.json(response.data);

    } catch (error: any) {
        console.error("❌ Swap Error:", error.response?.data || error.message);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
});




/**
 * Chat with AI
 */
app.post("/api/chat", ensureAgentReady, async (req: Request, res: Response): Promise<void> => {
    try {
        const userMessage: string = req.body.message;
        if (!userMessage) {
            res.status(400).json({ error: "Message is required" });
            return;
        }

        console.log(`💬 Received user message: "${userMessage}"`);

        // Ensure that config contains the required thread_id
        const updatedConfig = {
            ...config,
            configurable: {
                ...config.configurable,
                thread_id: "VPAI2-chat-session" // Ensure this is always present
            }
        };

        const stream = await agent.stream(
            { messages: [{ role: "user", content: userMessage }] },
            updatedConfig
        );

        let fullResponse = "";

        for await (const chunk of stream) {
            if ("agent" in chunk) {
                fullResponse += chunk.agent.messages[0].content + " ";
            }
        }

        console.log(`🤖 AI Response: "${fullResponse.trim()}"`);
        res.json({ response: fullResponse.trim() });

    } catch (error: any) {
        console.error("❌ Chat Error:", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
});


/**
 * Post a tweet
 */
app.post("/api/tweet", ensureAgentReady, async (req: Request, res: Response): Promise<void> => {
    try {
        const tweetContent: string = req.body.tweet;

        if (!tweetContent) {
            res.status(400).json({ error: "Tweet content is required" });
            return;
        }

        console.log("🚀 Posting Tweet:", tweetContent);

        // ✅ Directly call the Twitter API action
        const response = await agent.call({
            function: "postTweet", // 🔹 Ensure this matches the Twitter API function name
            args: { content: tweetContent },
        }, config);

        console.log("✅ Tweet Response:", response);
        res.json({ response: `Tweet posted successfully: ${tweetContent}` });

    } catch (error: any) {
        console.error("❌ Error posting tweet:", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
});






/**
 * Get wallet details
 */
app.get("/api/wallet", ensureAgentReady, async (_req: Request, res: Response): Promise<void> => {
    try {
        if (!config.walletProvider) {
            res.status(500).json({ error: "Wallet provider not initialized" });
            return;
        }

        const walletProvider = config.walletProvider;
        const walletData = await walletProvider.exportWallet();
        console.log(`🔹 Wallet Address: ${walletData.address}`);

        // ✅ Check if balance fetching is supported
        let balance: string = "Fetching...";
        if (typeof walletProvider.getNativeBalance === "function") {
            balance = await walletProvider.getNativeBalance(walletData.address);
            console.log(`💰 Wallet Balance: ${balance}`);
        } else {
            console.warn("⚠️ getNativeBalance() is not available in walletProvider.");
        }

        res.json({ address: walletData.address, balance });

    } catch (error: any) {
        console.error("❌ Wallet Fetch Error:", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
});


// Start the Express server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
