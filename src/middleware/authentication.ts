import type { Request, Response } from "express";

// Handle privlieged authentication. Used for managing update pushes/rollbacks.
export default (req: Request, res: Response, apiToken: string | undefined): boolean => {
    if (apiToken === undefined) {
        // API token is not set.
        throw new Error("API token is not set.");
    }
    if (req.headers.authorization === `Bearer ${apiToken}`) {
        // API token is valid.
        return false;
    }
    res.status(403).json({
        type: "UNAUTHORIZED",
        message: "Invalid API token. Do you have permission to push updates?",
    });
    return true;
};
