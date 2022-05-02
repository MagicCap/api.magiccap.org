import { UpdateCommit } from "../shared";

export class Updates {
    state: DurableObjectState;

    constructor(state: DurableObjectState) {
        this.state = state;
    }

    async fetch(request: Request) {
        let updates: UpdateCommit[] = [];
        await this.state.blockConcurrencyWhile(async () => {
            updates = await this.state.storage.get("updates_body") || [];
            if (request.method === "POST") {
                // Add the body of this request to the updates.
                updates = [await request.json(), ...updates];
                await this.state.storage.put("updates", updates);
            } else if (request.method === "DELETE") {
                // This will be rare - YOLO
                const commitHash = new URL(request.url).pathname.substring(1);
                updates = updates.filter(update => update.commitHash !== commitHash);
                await this.state.storage.put("updates", updates);
            }
        });
        return new Response(JSON.stringify(updates), {
            headers: {
                "Content-Type": "application/json",
            },
        });
    }
}
