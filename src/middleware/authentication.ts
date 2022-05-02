declare global {
    const API_TOKEN: string | undefined;
};

// Handle privlieged authentication. Used for managing update pushes/rollbacks.
export default (req: Request) => {
    if (API_TOKEN === undefined) {
        // API token is not set.
        throw new Error("API token is not set.");
    }
    if (req.headers.get("Authorization") === `Bearer ${API_TOKEN}`) {
        // API token is valid.
        return;
    }
    return new Response(JSON.stringify({
        type: "UNAUTHORIZED",
        message: "Invalid API token. Do you have permission to push updates?",
    }));
};
