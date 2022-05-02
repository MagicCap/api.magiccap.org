import paramsToObject from "../utils/params_to_object";
import processUpdateBits, { UpdateBits } from "../utils/process_update_bits";
import { BundleBlob, CoreBlob, UpdateAPIResponse, UpdateCommit, ModuleName } from "../shared";
import { router } from "./router";
import { encode } from "base64-arraybuffer";
import * as yup from "yup";

const schema = yup.object().shape({
    platform: yup.string().oneOf(["linux", "darwin"]).required(),
    main_commit: yup.string().required(),
    config_commit: yup.string().required(),
    uploaders_commit: yup.string().required(),
    editors_commit: yup.string().required(),
    selector_commit: yup.string().required(),
    core_commit: yup.string().required(),
    update_bits: yup.string().required(),
});

interface Env {
    UPDATES: DurableObjectNamespace;
}

type UpdateCommitResult = {
    cdnUrl: string;
    cdnMapUrl: string;
    commitHash: string;
};

// Finds a update commit based on the last commit for the module.
const findUpdateCommit = (
    moduleCommitHash: string, moduleName: ModuleName, updates: UpdateCommit[],
    updateBits: UpdateBits,
): UpdateCommitResult | null => {
    // Find the commit which this module was originally using.
    const commit = updates.find(c => c.commitHash === moduleCommitHash);
    if (!commit) {
        // Probably a custom commit.
        return null;
    }

    for (const update of updates) {
        if (update.commitHash === moduleCommitHash) {
            // We have came to the smae commit we already have.
            // No new updates were found.
            return null;
        }

        if (update.coreHash !== commit.coreHash) {
            // Core needs to align for updates to be allowed.
            continue;
        }

        // Check if we have a new update for our commit hash.
        let allowed = false;
        switch (update.updateType) {
            case "stable":
                allowed = updateBits.stable || updateBits.beta || updateBits.alpha;
                break;
            case "alpha":
                allowed = updateBits.alpha || updateBits.beta;
                break;
            case "beta":
                allowed = updateBits.beta;
                break;
        }

        // If this update is allowed, return it.
        if (allowed) {
            return {
                cdnMapUrl: update[`${moduleName}MapCdnUrl`],
                cdnUrl: update[`${moduleName}CdnUrl`],
                commitHash: update.commitHash,
            };
        }
    }

    // No updates were found.
    return null;
};

async function toBundleBlob(u: UpdateCommitResult | null): Promise<BundleBlob | null> {
    // If there is no update, return null.
    if (!u) return null;

    // Get all the parts from the CDN.
    const b64Result = (url: string): Promise<string> => {
        return fetch(url).then(async x => {
            if (x.ok) return encode(await x.arrayBuffer());
            throw new Error(`Failed to fetch ${url} (status: ${x.status})`);
        });
    };
    const [item, map] = await Promise.all([b64Result(u.cdnUrl), b64Result(u.cdnMapUrl)]);
    return {
        commitHash: u.commitHash,
        encodedBlob: item,
        encodedMapBlob: map,
    };
}

router.get("/v1/updates/poll", async (req: Request, env: Env) => {
    // Validate all of our query params.
    const searchParams = paramsToObject(req.url);
    if (!schema.isValidSync(searchParams, {strict: true, abortEarly: false})) {
        return new Response(JSON.stringify({
            type: "VALIDATOR_ERROR",
        }), {
            headers: {
                "Content-Type": "application/json",
            },
            status: 400,
        });
    }

    // Process the update bits.
    const updateBits = processUpdateBits(searchParams.update_bits);
    if (!updateBits) {
        return new Response(JSON.stringify({
            type: "UPDATE_BITS_ERROR",
        }), {
            headers: {
                "Content-Type": "application/json",
            },
            status: 400,
        });
    }

    // Get the updates. This is fine to do since this will be a GET request anyway.
    const id = env.UPDATES.idFromName("MAIN");
    const obj = env.UPDATES.get(id);
    const updates = await (await obj.fetch(req)).json() as UpdateCommit[];

    // Find the updates for each module.
    const mainUpdate = findUpdateCommit(searchParams.core_commit, "main", updates, updateBits);
    const configUpdate = findUpdateCommit(searchParams.config_commit, "config", updates, updateBits);
    const uploadersUpdate = findUpdateCommit(searchParams.uploaders_commit, "uploaders", updates, updateBits);
    const editorsUpdate = findUpdateCommit(searchParams.editors_commit, "editors", updates, updateBits);
    const selectorUpdate = findUpdateCommit(searchParams.selector_commit, "selector", updates, updateBits);

    // Handle finding any core updates.
    let core: CoreBlob | null = null;
    const currentCore = updates.find(c => c.commitHash === searchParams.core_commit);
    if (currentCore && searchParams.platform !== "linux") {
        // This is an actual valid update. Hunt for anything newer.
        for (const update of updates) {
            if (update.commitHash === searchParams.core_commit) {
                // We have just hit the same commit. Do not repeat it!
                break;
            }

            // Set the core to this update.
            core = {
                cdnUrl: update.darwinCoreCdnUrl,
                commitHash: update.commitHash,
            };
            break;
        }
    }

    // Create the API result.
    const apiResult: UpdateAPIResponse = {
        core,
        config: await toBundleBlob(configUpdate),
        editors: await toBundleBlob(editorsUpdate),
        main: await toBundleBlob(mainUpdate),
        uploaders: await toBundleBlob(uploadersUpdate),
        selector: await toBundleBlob(selectorUpdate),
    };
    return new Response(JSON.stringify(apiResult), {
        headers: {
            "Content-Type": "application/json",
        },
    });
});
