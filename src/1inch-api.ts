import axios from "axios";

const ONE_INCH_API_BASE_URL = "https://api.1inch.io/v5.0";

/**
 * Fetches a swap quote from the 1inch API
 * @param chainId - The blockchain network ID (1 = Ethereum Mainnet, 137 = Polygon, etc.)
 * @param fromToken - Address of the token to swap from
 * @param toToken - Address of the token to swap to
 * @param amount - Amount to swap (in token's smallest units, e.g., wei for ETH)
 * @param walletAddress - The wallet address to receive the tokens
 */
export async function getSwapQuote(
    chainId: number,
    fromToken: string,
    toToken: string,
    amount: string,
    walletAddress: string
) {
    try {
        const url = `${ONE_INCH_API_BASE_URL}/${chainId}/quote?fromTokenAddress=${fromToken}&toTokenAddress=${toToken}&amount=${amount}&walletAddress=${walletAddress}`;

        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error("❌ Error fetching swap quote:", error);
        throw error;
    }
}

/**
 * Executes a token swap via 1inch API
 * @param chainId - The blockchain network ID
 * @param fromToken - Address of the token to swap from
 * @param toToken - Address of the token to swap to
 * @param amount - Amount to swap (in token's smallest units)
 * @param walletAddress - The wallet address initiating the swap
 */
export async function executeSwap(
    chainId: number,
    fromToken: string,
    toToken: string,
    amount: string,
    walletAddress: string
) {
    try {
        const url = `${ONE_INCH_API_BASE_URL}/${chainId}/swap?fromTokenAddress=${fromToken}&toTokenAddress=${toToken}&amount=${amount}&walletAddress=${walletAddress}`;

        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error("❌ Error executing token swap:", error);
        throw error;
    }
}
