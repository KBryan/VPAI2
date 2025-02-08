import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { initializeAgent } from "./backend";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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
