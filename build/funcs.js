import { ApplicationError } from "@balam314/cli-app";
/**Parses icons out of the data in the icons.properties file from the Mindustry source code. */
export function parseIcons(data) {
    const icons = {};
    for (const line of data) {
        if (line.length == 0)
            continue;
        try {
            const [key, value] = line.split("=");
            icons["_" + value.split("|")[0].replaceAll("-", "_")] = String.fromCodePoint(parseInt(key));
        }
        catch (err) {
            if (!(err instanceof RangeError)) {
                console.error(line);
                throw err;
            }
        }
    }
    return icons;
}
export function fail(message) {
    throw new ApplicationError(message);
}
export function crash(message) {
    throw new Error(message);
}
export function impossible() {
    throw new Error(`this shouldn't be possible...`);
}
/** `object` must not have any properties that are not specified in the type definition. */
export function getKey(object, key) {
    if (object instanceof Object)
        crash(`getKey() is unsafe on an object that inherits from Object.prototype, because it will cause type unsoundness if key is "__proto__" or "hasOwnProperty"`);
    return object[key];
}
export function removeParams(object, ...remove) {
    return Object.fromEntries(Object.entries(object).filter(([k]) => !remove.includes(k)));
}
export function escapePUA(input) {
    return input.replace(/[\uE800-\uF8FF]/g, c => `\\u${c.codePointAt(0)?.toString(16).toUpperCase()}`);
}
export function sanitizeFilename(input) {
    if (input == ".") {
        return "_";
    }
    else if (input == "..") {
        return "__";
    }
    else if (/^(CON|AUX|PRN|NUL|(COM[0-9])|(LPT[0-9]))((\..*$)|$)/i.test(input)) {
        //turn things like con.msch -> _con.msch, which is no longer reserved
        input = "_" + input;
    }
    return input.replace(/[\0/\\"<>|:*?\uE800-\uF8FF]/g, "_");
}
export function tryRunOr(callback, errorHandler) {
    try {
        callback();
        return true;
    }
    catch (err) {
        if (err instanceof ApplicationError) {
            errorHandler(err);
            return false;
        }
        else
            throw err;
    }
}
