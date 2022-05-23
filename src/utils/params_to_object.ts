// Turns search params into an object.
export default (url: string): {[key: string]: string | string[]} => {
    const o: {[key: string]: string | string[]} = {};
    console.log(url);
    const params = new URL(url).searchParams;
    params.forEach((value, key) => {
        const a = o[key];
        switch (typeof a) {
            case "undefined":
                o[key] = value;
                break;
            case "string":
                o[key] = [a, value];
                break;
            case "object":
                // @ts-ignore: In this situation, since it is string | string[],
                // it will always be an array at this step.
                a.push(value);
                break;
        }
    });
    return o;
};
