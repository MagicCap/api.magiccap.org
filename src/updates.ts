import { UpdateCommit } from "./shared";
import mustEnv from "./utils/must_env";
import fetch from "node-fetch";
import { S3 } from "tiny-s3-uploader";

export const getUpdates = async (): Promise<UpdateCommit[]> => {
    const url = `https://${mustEnv("S3_HOSTNAME")}/updates.json`;
    const response = await fetch(url);
    return await response.json() as UpdateCommit[];
};

export const deleteUpdate = async (commitHash: string): Promise<void> => {
    let updates = await getUpdates();
    updates = updates.filter(u => u.commitHash !== commitHash);
    const s3 = new S3(
        mustEnv("S3_ENDPOINT"), mustEnv("S3_ACCESS_KEY_ID"),
        mustEnv("S3_SECRET_ACCESS_KEY"), mustEnv("S3_BUCKET"));
    await s3.upload(
        "updates.json", "public-read",
        "application/json", Buffer.from(JSON.stringify(updates)));
};

export const pushUpdate = async (update: UpdateCommit): Promise<void> => {
    let updates = await getUpdates();
    updates = [update, ...updates];
    const s3 = new S3(
        mustEnv("S3_ENDPOINT"), mustEnv("S3_ACCESS_KEY_ID"),
        mustEnv("S3_SECRET_ACCESS_KEY"), mustEnv("S3_BUCKET"));
    await s3.upload(
        "updates.json", "public-read",
        "application/json", Buffer.from(JSON.stringify(updates)));
};
