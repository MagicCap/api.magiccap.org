import authentication from "../middleware/authentication";
import { UpdateCommit, ModuleName } from "../shared";
import { router } from "./router";
import SparkMD5 from "spark-md5";
import { S3 } from "tiny-s3-uploader";

interface Env {
    UPDATES: DurableObjectNamespace;
}

interface PushMetadata {
    darwinCdnUrl: string;
    commitHash: string;
    coreHash: string;
    updateType: "stable" | "alpha" | "beta";
}

declare global {
    const S3_HOSTNAME: string;
    const S3_ENDPOINT: string;
    const S3_ACCESS_KEY_ID: string;
    const S3_SECRET_ACCESS_KEY: string;
    const S3_BUCKET: string;
}

const uploadFile = async (buffer: ArrayBuffer, path: string, contentType: string): Promise<string> => {
    const s3 = new S3(S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET);
    await s3.upload(path, "public-read", contentType, buffer);
    return `https://${S3_HOSTNAME}/${path}`;
};

const uploadModuleCommitInfo = async (newCommit: UpdateCommit, moduleName: ModuleName, lastUpdate: UpdateCommit, form: FormData) => {
    // Get the form items for both.
    const jsItem = form.get(`${moduleName}.js`);
    const mapItem = form.get(`${moduleName}.js.map`);

    // Get the JS buffer.
    let jsBuffer;
    if (jsItem instanceof File) {
        jsBuffer = await jsItem.arrayBuffer();
    } else {
        const enc = new TextEncoder();
        jsBuffer = enc.encode(jsItem!);
    }

    // Create a MD5 hash of the JS.
    const jsHash = SparkMD5.ArrayBuffer.hash(jsBuffer);
    if (jsHash === lastUpdate[`${moduleName}Hash`]) {
        // Just mount the last commits information about this.
        newCommit[`${moduleName}Hash`] = lastUpdate[`${moduleName}Hash`];
        newCommit[`${moduleName}CdnUrl`] = lastUpdate[`${moduleName}CdnUrl`];
        newCommit[`${moduleName}MapCdnUrl`] = lastUpdate[`${moduleName}MapCdnUrl`];
    } else {
        // Get the map as a buffer.
        let mapBuffer;
        if (mapItem instanceof File) {
            mapBuffer = await mapItem.arrayBuffer();
        } else {
            const enc = new TextEncoder();
            mapBuffer = enc.encode(mapItem!);
        }

        // This is a different JS file to the last one. Upload it.
        newCommit[`${moduleName}Hash`] = jsHash;
        newCommit[`${moduleName}CdnUrl`] = await uploadFile(jsBuffer, `${moduleName}/${jsHash}.js`, "application/javascript");
        newCommit[`${moduleName}MapCdnUrl`] = await uploadFile(mapBuffer, `${moduleName}/${jsHash}.js.map`, "application/json");
    }
};

router.post("/v1/updates/push", async (req: Request, env: Env) => {
    // Handle the authentication.
    const res = authentication(req as Request);
    if (res) return res;

    // Get the form data.
    let form;
    try {
        form = await req.formData();
    } catch {
        return new Response(JSON.stringify({
            type: "BAD_REQUEST",
            message: "Failed to parse form data.",
        }), {
            status: 400,
        });
    }

    // Get the keys.
    const keys = new Set([...form.keys()]);
    const areSetsEqual = (a: Set<string>, b: Set<string>) =>
        a.size === b.size && [...a].every(value => b.has(value));
    if (!areSetsEqual(new Set([
        // The core JavaScript blobs.
        "uploaders.js", "editors.js", "main.js", "config.js", "selector.js",

        // The JavaScript maps.
        "uploaders.js.map", "editors.js.map", "main.js.map", "config.js.map", "selector.js.map",

        // The metadata.
        "metadata",
    ]), keys)) {
        return new Response(JSON.stringify({
            type: "BAD_REQUEST",
            message: "Missing required keys.",
        }), {
            status: 400,
        });
    }

    // Get the metadata.
    const metadata = JSON.parse(form.get("metadata") as string) as PushMetadata;

    // Get the last update.
    const id = env.UPDATES.idFromName("MAIN");
    const obj = env.UPDATES.get(id);
    const lastUpdate = (await (await obj.fetch(req)).json() as UpdateCommit[])[0];

    // Create the commit blob.
    const commit: UpdateCommit = {
        commitHash: metadata.commitHash,
        configCdnUrl: "",
        configHash: "",
        configMapCdnUrl: "",
        darwinCoreCdnUrl: metadata.darwinCdnUrl,
        coreHash: metadata.coreHash,
        editorsCdnUrl: "",
        editorsHash: "",
        editorsMapCdnUrl: "",
        mainCdnUrl: "",
        mainHash: "",
        mainMapCdnUrl: "",
        uploadersCdnUrl: "",
        uploadersHash: "",
        uploadersMapCdnUrl: "",
        selectorCdnUrl: "",
        selectorHash: "",
        selectorMapCdnUrl: "",
        updateType: metadata.updateType,
    };

    // Upload and update all modules in this blob.
    await uploadModuleCommitInfo(commit, "uploaders", lastUpdate, form);
    await uploadModuleCommitInfo(commit, "editors", lastUpdate, form);
    await uploadModuleCommitInfo(commit, "main", lastUpdate, form);
    await uploadModuleCommitInfo(commit, "config", lastUpdate, form);
    await uploadModuleCommitInfo(commit, "selector", lastUpdate, form);

    // Publish the commit.
    return obj.fetch(req.url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(commit),
    });
});
