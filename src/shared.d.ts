export type BundleBlob = {
    // A base64 encoded blob of the bundle specified.
    encodedBlob: string;

    // A base64 encoded blob for the map of the bundle.
    encodedMapBlob: string;

    // Defines the commit hash.
    commitHash: string;
};

export type CoreBlob = {
    // Defines the CDN URL.
    cdnUrl: string;

    // Defines the commit hash.
    commitHash: string;
};

export type UpdateAPIResponse = {
    // Defines the uploaders kernel blob, if it can be hot updated on its own.
    uploaders: BundleBlob | null;

    // Defines the editors blob, if it can be hot updated on its own.
    editors: BundleBlob | null;

    // Defines the main blob, if it can be hot updated on its own.
    main: BundleBlob | null;

    // Defines the config blob, if it can be hot updated on its own.
    config: BundleBlob | null;

    // Defines the selector blob, if it can be hot updated on its own.
    selector: BundleBlob | null;

    // Defines if the core electron bundle needs updating.
    core: CoreBlob | null;
};

export type UpdateCommit = {
    // Defines the commit hash.
    commitHash: string;

    // Defines the state of the update.
    updateType: "stable" | "alpha" | "beta";

    // Defines the platform CDN URL's for core.
    darwinCoreCdnUrl: string;
    coreHash: string;

    // Defines the CDN URL's used for uploaders.
    uploadersCdnUrl: string;
    uploadersMapCdnUrl: string;
    uploadersHash: string;

    // Defines the CDN URL's used for editors.
    editorsCdnUrl: string;
    editorsMapCdnUrl: string;
    editorsHash: string;

    // Defines the CDN URL's used for main.
    mainCdnUrl: string;
    mainMapCdnUrl: string;
    mainHash: string;

    // Defines the CDN URL's used for config.
    configCdnUrl: string;
    configMapCdnUrl: string;
    configHash: string;

    // Defines the CDN URL's used for selector.
    selectorCdnUrl: string;
    selectorMapCdnUrl: string;
    selectorHash: string;
};

export type ModuleName = "uploaders" | "editors" | "main" | "config" | "selector";
