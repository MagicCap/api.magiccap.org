import { router } from "./router";
import authentication from "../middleware/authentication";
import { Request as IttyRequest } from "itty-router";

interface Env {
    UPDATES: DurableObjectNamespace;
}

router.delete("/v1/updates/delete/:commitHash", (req: IttyRequest, env: Env) => {
    // Handle the authentication.
    const res = authentication(req as Request);
    if (res) return res;

    // Perform the DELETE request.
    const commitHash = (req.params as any).commitHash as string;
    const url = new URL(req.url);
    url.pathname = "/" + commitHash;
    const id = env.UPDATES.idFromName("MAIN");
    const obj = env.UPDATES.get(id);
    return obj.fetch(url.toString());
});
