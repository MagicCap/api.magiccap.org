import authentication from "../middleware/authentication";
import { UpdateCommit, ModuleName } from "../shared";
import { getUpdates, pushUpdate } from "../updates";
import mustEnv from "../utils/must_env";
import { router } from "./router";
import SparkMD5 from "spark-md5";
import { S3 } from "tiny-s3-uploader";
import type { Request, Response } from "express";
import formidable, { File } from "formidable";
import { readFile } from "fs/promises";

interface PushMetadata {
    darwinCdnUrl: string;
    commitHash: string;
    coreHash: string;
    updateType: "stable" | "alpha" | "beta";
}

const uploadFile = async (buffer: Buffer, path: string, contentType: string): Promise<string> => {
    const s3 = new S3(
        mustEnv("S3_ENDPOINT"), mustEnv("S3_ACCESS_KEY_ID"),
        mustEnv("S3_SECRET_ACCESS_KEY"), mustEnv("S3_BUCKET"));
    await s3.upload(path, "public-read", contentType, buffer);
    return `https://${mustEnv("S3_HOSTNAME")}/${path}`;
};

const uploadModuleCommitInfo = async (newCommit: UpdateCommit, moduleName: ModuleName, lastUpdate: UpdateCommit | undefined, form: {[key: string]: string | File}) => {
    // Get the form items for both.
    const jsItem = form[`${moduleName}.js`];
    const mapItem = form[`${moduleName}.js.map`];

    // Get the JS buffer.
    let jsBuffer;
    if (typeof jsItem === "string") {
        jsBuffer = Buffer.from(jsItem);
    } else {
        jsBuffer = await readFile(jsItem.filepath);
    }

    // Create a MD5 hash of the JS.
    const jsHash = SparkMD5.ArrayBuffer.hash(jsBuffer);
    if (lastUpdate && jsHash === lastUpdate[`${moduleName}Hash`]) {
        // Just mount the last commits information about this.
        newCommit[`${moduleName}Hash`] = lastUpdate[`${moduleName}Hash`];
        newCommit[`${moduleName}CdnUrl`] = lastUpdate[`${moduleName}CdnUrl`];
        newCommit[`${moduleName}MapCdnUrl`] = lastUpdate[`${moduleName}MapCdnUrl`];
    } else {
        // Get the map as a buffer.
        let mapBuffer;
        if (typeof mapItem === "string") {
            mapBuffer = Buffer.from(mapItem);
        } else {
            mapBuffer = await readFile(mapItem.filepath);
        }

        // This is a different JS file to the last one. Upload it.
        newCommit[`${moduleName}Hash`] = jsHash;
        newCommit[`${moduleName}CdnUrl`] = await uploadFile(jsBuffer, `${moduleName}/${jsHash}.js`, "application/javascript");
        newCommit[`${moduleName}MapCdnUrl`] = await uploadFile(mapBuffer, `${moduleName}/${jsHash}.js.map`, "application/json");
    }
};

const getForm = (req: Request) => new Promise<{[key: string]: string | File}>((res, rej) => {
    const form = formidable({});
    form.parse(req, (err, fields, files) => {
        // Handle if this errors.
        if (err) {
            rej(err);
            return;
        }

        // Merge fields and files.
        type StringOrFile = string | File;
        const form: {[key: string]: StringOrFile} = {};
        const process = (key: string, value: StringOrFile | StringOrFile[]) => {
            if (Array.isArray(value)) {
                if (!value.length) {
                    rej(new Error(`Missing value for existing form item ${key}`));
                    return;
                }
                form[key] = value[0];
            } else {
                form[key] = value;
            }
        };
        for (const [key, value] of Object.entries(fields)) process(key, value);
        for (const [key, value] of Object.entries(files)) process(key, value);
        res(form);
    });
});

const mustString = (contents: {[key: string]: string | File}, key: string) => {
    const x = contents[key];
    if (typeof x === "string") return x;
    throw new Error(`Expected ${key} to be a string`);
}

router.post("/v1/updates/push", async (req: Request, res: Response): Promise<void> => {
    // Handle the authentication.
    const returned = authentication(req, res, process.env.API_TOKEN);
    if (returned) return;

    // Get the form.
    let form: {[key: string]: string | File};
    try {
        form = await getForm(req);
    } catch {
        res.status(400).json({
            type: "BAD_REQUEST",
            message: "Failed to parse form data.",
        });
        return;
    }

    // Get the keys.
    const keys = new Set(Object.keys(form));
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
        res.status(400).json({
            type: "BAD_REQUEST",
            message: "Missing required keys.",
        });
        return;
    }

    // Get the metadata.
    const metadata = JSON.parse(mustString(form, "metadata") as string) as PushMetadata;

    // Get the last update.
    const lastUpdate = (await getUpdates())[0] as UpdateCommit | undefined;

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
    await pushUpdate(commit);
    res.status(204).end();
});
