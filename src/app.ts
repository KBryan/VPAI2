document.addEventListener("DOMContentLoaded", () => {
    const chatBox = document.getElementById("chat-box")!;
    const userInput = document.getElementById("user-input") as HTMLInputElement;
    const sendBtn = document.getElementById("send-btn")!;
    const tweetInput = document.getElementById("tweet-input") as HTMLInputElement;
    const tweetBtn = document.getElementById("tweet-btn")!;
    const walletBtn = document.getElementById("wallet-btn")!;

    /**
     * Appends a message to the chat UI
     * @param sender The sender's name (e.g., "You" or "Agent")
     * @param message The message content
     * @param isError Whether the message is an error (for styling)
     */
    function appendMessage(sender: string, message: string, isError: boolean = false) {
        const messageDiv = document.createElement("div");
        messageDiv.innerHTML = `<strong>${sender}:</strong> ${message}`;
        if (isError) messageDiv.style.color = "red";
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    /**
     * Sends a message to the chat API and handles response
     * @param message User input message
     */
    async function sendMessage(message: string) {
        appendMessage("You", message);

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message }),
            });

            if (!response.ok) throw new Error(`Error: ${response.statusText}`);

            const data = await response.json();
            appendMessage("Agent", data.response || "No response received.");
        } catch (error) {
            appendMessage("Agent", `Failed to send message: ${error}`, true);
        }
    }

    /**
     * Sends a tweet using the tweet API
     */
    async function sendTweet() {
        const tweet = tweetInput.value.trim();
        if (!tweet) return;

        appendMessage("You", `Tweeting: "${tweet}"`);

        try {
            const response = await fetch("/api/tweet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tweet }),
            });

            if (!response.ok) throw new Error(`Error: ${response.statusText}`);

            const data = await response.json();
            appendMessage("Agent", data.response || "Tweet failed.");
        } catch (error) {
            appendMessage("Agent", `Error posting tweet: ${error}`, true);
        }
    }

    /**
     * Fetches and displays wallet details
     */
    async function fetchWalletDetails() {
        appendMessage("You", "Fetching wallet details...");

        try {
            const response = await fetch("/api/wallet");

            if (!response.ok) throw new Error(`Error: ${response.statusText}`);

            const data = await response.json();
            appendMessage("Agent", `Wallet Address: ${data.address}, Balance: ${data.balance}`);
        } catch (error) {
            appendMessage("Agent", `Error fetching wallet details: ${error}`, true);
        }
    }

    // 🎯 Event Listeners
    sendBtn.addEventListener("click", () => {
        const message = userInput.value.trim();
        if (message) {
            sendMessage(message);
            userInput.value = "";
        }
    });

    tweetBtn.addEventListener("click", sendTweet);
    walletBtn.addEventListener("click", fetchWalletDetails);
});
