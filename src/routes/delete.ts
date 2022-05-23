import { router } from "./router";
import authentication from "../middleware/authentication";
import type { Request, Response } from "express";
import { deleteUpdate } from "../updates";

router.delete("/v1/updates/delete/:commitHash", async (req: Request, res: Response): Promise<void> => {
    // Handle the authentication.
    const returned = authentication(req, res, process.env.API_TOKEN);
    if (returned) return;

    // Perform the DELETE request.
    const commitHash = req.params.commitHash;
    await deleteUpdate(commitHash);
    res.status(204).end();
});
