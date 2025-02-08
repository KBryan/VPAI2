import {
    AgentKit,
    CdpWalletProvider,
    wethActionProvider,
    walletActionProvider,
    erc20ActionProvider,
    cdpApiActionProvider,
    cdpWalletActionProvider,
    pythActionProvider,
    twitterActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import * as fs from "fs";

dotenv.config();

// Wallet storage file
const WALLET_DATA_FILE = "wallet_data.txt";

/**
 * Validate environment variables
 */
function validateEnvironment(): void {
    const missingVars: string[] = [];
    const requiredVars = [
        "OPENAI_API_KEY",
        "CDP_API_KEY_NAME",
        "CDP_API_KEY_PRIVATE_KEY",
        "TWITTER_API_KEY",
        "TWITTER_API_SECRET",
        "TWITTER_ACCESS_TOKEN",
        "TWITTER_ACCESS_TOKEN_SECRET",
    ];

    requiredVars.forEach(varName => {
        if (!process.env[varName]) {
            missingVars.push(varName);
        }
    });

    if (missingVars.length > 0) {
        console.error("❌ Missing environment variables:", missingVars.join(", "));
        process.exit(1);
    }
}

validateEnvironment();

/**
 * Initialize the AI Agent with Web3 & Twitter capabilities
 *
 * @returns {Promise<{agent: any, config: any}>}
 */
export async function initializeAgent() {  // ✅ Ensure this function is properly exported
    try {
        console.log("🚀 Initializing AI Agent...");

        // Initialize OpenAI LLM
        const llm = new ChatOpenAI({ model: "gpt-4o-mini" });

        let walletDataStr: string | null = null;
        if (fs.existsSync(WALLET_DATA_FILE)) {
            try {
                walletDataStr = fs.readFileSync(WALLET_DATA_FILE, "utf8");
            } catch (error) {
                console.error("❌ Error reading wallet data:", error);
            }
        }

        // Configure Web3 Wallet Provider
        const walletConfig = {
            apiKeyName: process.env.CDP_API_KEY_NAME,
            apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
            cdpWalletData: walletDataStr || undefined,
            networkId: process.env.NETWORK_ID || "base-sepolia",
        };
        const walletProvider = await CdpWalletProvider.configureWithWallet(walletConfig);

        // Configure AgentKit with Twitter & Web3 actions
        const agentkit = await AgentKit.from({
            walletProvider,
            actionProviders: [
                wethActionProvider(),
                pythActionProvider(),
                walletActionProvider(),
                erc20ActionProvider(),
                cdpApiActionProvider({
                    apiKeyName: process.env.CDP_API_KEY_NAME,
                    apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
                }),
                cdpWalletActionProvider({
                    apiKeyName: process.env.CDP_API_KEY_NAME,
                    apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
                }),
                twitterActionProvider(), // 🔹 Added Twitter API
            ],
        });

        const tools = await getLangChainTools(agentkit);
        const memory = new MemorySaver();
        const agentConfig = {
            configurable: {
                thread_id: `VPAI2-Session-${Date.now()}`, // Ensuring a unique session ID
            }
        };
        // Create the AI Agent
        const agent = createReactAgent({
            llm,
            tools,
            checkpointSaver: memory,
            messageModifier: `
                You are an AI assistant capable of:
                - Interacting with Web3 wallets (fetch balance, transfer funds)
                - Posting Tweets via Twitter API
                - Providing AI-powered responses
                
                If you cannot perform an action, guide the user to relevant API documentation.
            `,
        });

        // Save wallet data
        const exportedWallet = await walletProvider.exportWallet();
        fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(exportedWallet));

        console.log("✅ AI Agent initialized successfully!");
        return { agent, config: { walletProvider, agentConfig } };
    } catch (error) {
        console.error("❌ Failed to initialize agent:", error);
        throw error;
    }
}
