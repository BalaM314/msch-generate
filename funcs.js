import * as fs from "fs";
/**Parses command line args. */
export function parseArgs(args) {
    let parsedArgs = {};
    let mainArgs = [];
    let i = 0;
    while (true) {
        i++;
        if (i > 1000) {
            throw new Error("Too many arguments!");
        }
        let arg = args.splice(0, 1)[0];
        if (arg == undefined)
            break;
        if (arg.startsWith("--")) {
            if (args[0]?.startsWith("-"))
                parsedArgs[arg.substring(2)] = "null";
            else
                parsedArgs[arg.substring(2)] = args.splice(0, 1)[0] ?? "null";
        }
        else if (arg.startsWith("-")) {
            if (args[0]?.startsWith("-"))
                parsedArgs[arg.substring(1)] = "null";
            else
                parsedArgs[arg.substring(1)] = args.splice(0, 1)[0] ?? "null";
        }
        else {
            mainArgs.push(arg);
        }
    }
    return [parsedArgs, mainArgs];
}
export function toHexCodes(buf) {
    return Array.from(buf).map(el => ("00" + el.toString(16).toUpperCase()).slice(-2));
}
export function fromHexCodes(str) {
    return Buffer.from(str.split(" ").map(el => parseInt(el, 16)));
}
export function err(message) {
    throw new Error(message);
}
/**Parses icons out of the data in the icons.properties file from the Mindustry source code. */
export function parseIcons(data) {
    const icons = {};
    for (const line of data) {
        if (line.length == 0)
            continue;
        try {
            icons["_" + line.split("=")[1].split("|")[0].replaceAll("-", "_")] = String.fromCodePoint(parseInt(line.split("=")[0]));
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
export function readFileOrNull(path, encoding = "utf8") {
    if (fs.existsSync(path) && fs.lstatSync(path).isFile()) {
        return fs.readFileSync(path, encoding);
    }
    else {
        return null;
    }
}
