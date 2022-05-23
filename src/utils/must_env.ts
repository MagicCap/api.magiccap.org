export default (key: string) => {
    const v = process.env[key];
    if (!v) {
        throw new Error(`Missing environment variable ${key}`);
    }
    return v;
};
