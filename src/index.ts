import {
    AgentKit,
    CdpWalletProvider,
    wethActionProvider,
    walletActionProvider,
    erc20ActionProvider,
    cdpApiActionProvider,
    cdpWalletActionProvider,
    pythActionProvider,
    twitterActionProvider, // 🔹 Add Twitter support
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as readline from "readline";

dotenv.config();

/**
 * Validates that required environment variables are set
 *
 * @throws {Error} - If required environment variables are missing
 * @returns {void}
 */
function validateEnvironment(): void {
    const missingVars: string[] = [];

    // Check required variables
    const requiredVars = [
        "OPENAI_API_KEY",
        "CDP_API_KEY_NAME",
        "CDP_API_KEY_PRIVATE_KEY",
        "TWITTER_API_KEY", // 🔹 Twitter API key
        "TWITTER_API_SECRET", // 🔹 Twitter secret
        "TWITTER_ACCESS_TOKEN", // 🔹 Twitter access token
        "TWITTER_ACCESS_TOKEN_SECRET", // 🔹 Twitter token secret
    ];

    requiredVars.forEach(varName => {
        if (!process.env[varName]) {
            missingVars.push(varName);
        }
    });

    if (missingVars.length > 0) {
        console.error("Error: Required environment variables are not set");
        missingVars.forEach(varName => {
            console.error(`${varName}=your_${varName.toLowerCase()}_here`);
        });
        process.exit(1);
    }

    if (!process.env.NETWORK_ID) {
        console.warn("Warning: NETWORK_ID not set, defaulting to base-sepolia testnet");
    }
}

// Add this before any other execution
validateEnvironment();

// Configure a file to persist the agent's CDP MPC Wallet Data
const WALLET_DATA_FILE = "wallet_data.txt";

/**
 * Initialize the agent with CDP AgentKit and Twitter
 *
 * @returns Agent executor and config
 */
async function initializeAgent() {
    try {
        const llm = new ChatOpenAI({ model: "gpt-4o-mini" });

        let walletDataStr: string | null = null;

        if (fs.existsSync(WALLET_DATA_FILE)) {
            try {
                walletDataStr = fs.readFileSync(WALLET_DATA_FILE, "utf8");
            } catch (error) {
                console.error("Error reading wallet data:", error);
            }
        }

        const config = {
            apiKeyName: process.env.CDP_API_KEY_NAME,
            apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
            cdpWalletData: walletDataStr || undefined,
            networkId: process.env.NETWORK_ID || "base-sepolia",
        };

        const walletProvider = await CdpWalletProvider.configureWithWallet(config);

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
                twitterActionProvider(), // 🔹 Added Twitter support
            ],
        });

        const tools = await getLangChainTools(agentkit);
        const memory = new MemorySaver();
        const agentConfig = { configurable: { thread_id: "CDP AgentKit Chatbot + Twitter" } };

        const agent = createReactAgent({
            llm,
            tools,
            checkpointSaver: memory,
            messageModifier: `
        You are a helpful AI that can interact with both Web3 wallets and Twitter (X) using the Coinbase Developer Platform.
        You can:
        - Retrieve wallet details
        - Fetch wallet balances
        - Transfer funds
        - Interact with the Twitter API (post tweets, fetch timelines, etc.)
        
        If a user requests something unsupported, direct them to relevant API documentation.
        `,
        });

        // Save wallet data
        const exportedWallet = await walletProvider.exportWallet();
        fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(exportedWallet));

        return { agent, config: agentConfig };
    } catch (error) {
        console.error("Failed to initialize agent:", error);
        throw error;
    }
}

/**
 * Post a tweet
 */
/**
 * Post a tweet using the agent's Twitter integration.
 */
async function postTweet(agent: any, config: any, tweetContent: string) {
    try {
        console.log("🚀 Posting Tweet:", tweetContent);

        // Properly format the request
        const stream = await agent.run({
            messages: [new HumanMessage(`Post the following tweet: "${tweetContent}"`)],
        }, config);

        for await (const chunk of stream) {
            if ("agent" in chunk) {
                console.log("✅ Tweet Posted:", chunk.agent.messages[0].content);
            } else {
                console.log("🛠️ Twitter Response:", chunk.tools.messages[0].content);
            }
        }

        console.log("🎉 Successfully posted the tweet!");
    } catch (error: any) {
        console.error("❌ Error posting tweet:", error.message);
    }
}


/**
 * Run the agent interactively based on user input
 */
async function runChatMode(agent: any, config: any) {
    console.log("💬 Chat mode activated. Type 'exit' to quit.");

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    const question = (prompt: string): Promise<string> =>
        new Promise(resolve => rl.question(prompt, resolve));

    try {
        while (true) {
            const userInput = await question("\n💬 You: ");

            if (userInput.toLowerCase() === "exit") {
                break;
            } else if (userInput.toLowerCase().startsWith("tweet")) {
                const tweetContent = userInput.replace("tweet", "").trim();
                await postTweet(agent, config, tweetContent);
            } else {
                const stream = await agent.stream({ messages: [new HumanMessage(userInput)] }, config);

                for await (const chunk of stream) {
                    if ("agent" in chunk) {
                        console.log("🤖 Agent:", chunk.agent.messages[0].content);
                    } else if ("tools" in chunk) {
                        console.log("🛠️ Tools:", chunk.tools.messages[0].content);
                    }
                    console.log("-------------------");
                }
            }
        }
    } catch (error: any) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    } finally {
        rl.close();
    }
}

/**
 * Choose mode (interactive chat or autonomous)
 */
async function chooseMode(): Promise<"chat" | "auto"> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    const question = (prompt: string): Promise<string> =>
        new Promise(resolve => rl.question(prompt, resolve));

    while (true) {
        console.log("\nAvailable modes:");
        console.log("1. chat    - Interactive chat mode");
        console.log("2. auto    - Autonomous action mode");

        const choice = (await question("\nChoose a mode (enter number or name): ")).toLowerCase().trim();

        if (choice === "1" || choice === "chat") {
            rl.close();
            return "chat";
        } else if (choice === "2" || choice === "auto") {
            rl.close();
            return "auto";
        }
        console.log("Invalid choice. Please try again.");
    }
}

/**
 * Start chatbot
 */
async function main(): Promise<void> {
    try {
        const { agent, config } = await initializeAgent();
        const mode = await chooseMode();

        if (mode === "chat") {
            await runChatMode(agent, config);
        } else {
            console.log("🚀 Autonomous mode coming soon...");
        }
    } catch (error: any) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    console.log("🚀 Starting Twitter & Wallet Agent...");
    main().catch(error => {
        console.error("❌ Fatal error:", error.message);
        process.exit(1);
    });
}
