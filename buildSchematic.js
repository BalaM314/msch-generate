import * as fs from "fs";
import path from "path";
import { Validator } from "jsonschema";
import { compileMlogxToMlog, getState, getLocalState, getSettings, CompilerError } from "mlogx";
import { BlockConfig, BlockConfigType, Schematic, Tile, Item, Point2 } from "msch";
import { fail, impossible } from "./funcs.js";
const powerNodes = ["power-node", "power-node-large", "power-source", "surge-tower"];
function getBlockData(name, data, blockX, blockY, schematicConsts) {
    if (name == "")
        return null;
    const config = data.tiles.blocks[name] ?? fail(`Missing configuration data for block "${name}".`);
    return new Tile(config.id, blockX, blockY, getBlockConfig(config, data, blockX, blockY, schematicConsts), config.rotation ?? 0);
}
;
function getLinks(config, data, blockX, blockY) {
    if (!config.links)
        return [];
    //Reverse the rows so that row 0 is at y position 0 instead of (height - y - 1)
    const reversedGrid = data.tiles.grid.slice().reverse();
    return config.links.map(link => reversedGrid.map((row, y) => row
        .map((block, x) => [block, x])
        .filter(([block, x]) => block == link)
        .map(([block, x]) => ({
        x: x - blockX,
        y: y - blockY,
        name: `!!` //!! is invalid, so the game will determine the correct link name
    })))).flat(2);
}
function getBlockConfig(config, data, blockX, blockY, schematicConsts) {
    if (config.links && powerNodes.includes(config.id)) {
        //Special case for power nodes
        return new BlockConfig(BlockConfigType.pointarray, getLinks(config, data, blockX, blockY).map(link => new Point2(link.x, link.y)));
    }
    if (!config.config)
        return BlockConfig.null;
    switch (config.config.type) {
        case "item":
            return new BlockConfig(BlockConfigType.content, [0, Item[config.config.value] ?? fail(`Unknown item ${config.config.value}`)]);
        case "boolean":
            return new BlockConfig(BlockConfigType.boolean, config.config.value == "false" ? false : true);
        case "point":
            const [x, y, ...rest] = config.config.value.split(/, ?/);
            if (!x || !y || rest.length > 0)
                fail(`Invalid point config "${config.config.value}", should be of the form "5,6"`);
            return new BlockConfig(BlockConfigType.point, new Point2(+x, +y));
        case "string":
            return new BlockConfig(BlockConfigType.string, config.config.value);
        case "program":
            const program = data.tiles.programs?.[config.config.value] ?? fail(`Unknown program "${config.config.value}"`);
            let code;
            if (typeof program == "string") {
                code = getProgramFromFile(program, schematicConsts);
            }
            else if (program instanceof Array) {
                code = program;
            }
            else
                impossible();
            return new BlockConfig(BlockConfigType.bytearray, Tile.compressLogicConfig({
                links: getLinks(config, data, blockX, blockY),
                code
            }));
        default:
            fail(`Invalid config type "${config.config.type}"`);
    }
}
function getProgramFromFile(path, schematicConsts) {
    if (path.endsWith(".mlogx")) {
        console.log(`Compiling program ${path}`);
        return compileMlogxProgram(path, schematicConsts);
    }
    if (!fs.existsSync(path)) {
        fail(`Path "${path}" does not exist.`);
    }
    if (!fs.lstatSync(path).isFile()) {
        fail(`Path "${path}" is not a file.`);
    }
    return fs.readFileSync(path, 'utf-8').split(/\r?\n/g);
}
function compileMlogxProgram(filepath, schematicConsts) {
    const data = fs.readFileSync(filepath, "utf-8").split(/\r?\n/g);
    const directory = path.join(filepath, "..");
    const settings = getSettings(directory, true);
    const globalState = getState(settings, directory, {
        namedArgs: {}
    });
    const state = getLocalState(globalState, path.extname(filepath), new Map(), //no need for icons, we already have them in schematicConsts
    schematicConsts);
    try {
        return compileMlogxToMlog(data, state).outputProgram.map(s => s.text);
    }
    catch (err) {
        if (err instanceof CompilerError) {
            throw err;
        }
        else {
            console.error(`mlogx crashed!`);
            throw err;
        }
    }
}
;
function stringifyConst(value) {
    return value instanceof Array ? value.join(", ") : value.toString();
}
function replaceConsts(text, consts) {
    const specifiedConsts = text.match(/(?<!\\\$\()(?<=\$\()[\w-.]+(?=\))/g);
    specifiedConsts?.forEach(key => {
        const value = consts.get(key);
        if (value) {
            text = text.replace(`$(${key})`, stringifyConst(value));
        }
        else {
            console.warn(`Unknown compiler const ${key}`);
        }
    });
    if (!text.includes("$"))
        return text;
    for (const [key, value] of consts) {
        text = text.replaceAll(`$${key}`, stringifyConst(value));
        if (!text.includes("$"))
            return text;
    }
    return text;
}
function getSchematicConsts(data, extraConsts) {
    return new Map(([
        ["name", data.info.name],
        ["version", data.info.version],
        ["authors", data.info.authors],
        ...Object.entries(data.consts ?? {}),
        ...Object.entries(extraConsts),
    ])
        .sort(([ka, va], [kb, vb]) => kb.length - ka.length));
}
function replaceConstsInConfig(data, icons) {
    const compilerConsts = getSchematicConsts(data, icons);
    //Replace the name using the compiler consts (to put version in name)
    //then update the compiler consts with the new name
    //(to put name in description, or processors)
    const newName = replaceConsts(data.info.name, compilerConsts);
    compilerConsts.set("name", newName);
    const newDescription = data.info.description ? replaceConsts(data.info.description, compilerConsts) : undefined;
    if (newDescription)
        compilerConsts.set("description", newDescription);
    return [{
            info: {
                ...data.info,
                name: newName,
                description: newDescription,
                labels: data.info.labels?.map(label => replaceConsts(label, compilerConsts))
            },
            tiles: {
                grid: data.tiles.grid.map(row => row.map(name => replaceConsts(name, compilerConsts))),
                programs: data.tiles.programs,
                blocks: Object.fromEntries(Object.entries(data.tiles.blocks) //TODO no longer necessary in some cases
                    .map(([name, blockData]) => ([name, {
                        ...blockData,
                        id: replaceConsts(blockData.id, compilerConsts),
                        config: blockData.config ? {
                            type: blockData.config.type,
                            value: replaceConsts(blockData.config.value, compilerConsts)
                        } : undefined
                    }])))
            },
            consts: data.consts,
        }, compilerConsts];
}
export function buildSchematic(rawData, schema, icons) {
    const jsonschem = new Validator();
    let unvalidatedData;
    try {
        unvalidatedData = JSON.parse(rawData);
    }
    catch (err) {
        fail(`Schematic file contains invalid JSON: ${err.message}`);
    }
    const { valid, errors } = jsonschem.validate(unvalidatedData, schema);
    if (!valid)
        fail(`Schematic file is invalid: ${errors[0].stack}`);
    const [data, schematicConsts] = replaceConstsInConfig(unvalidatedData, icons);
    const width = data.tiles.grid.map(row => row.length).sort().at(-1) ?? 0;
    const height = data.tiles.grid.length;
    if (data.info.tags && "labels" in data.info.tags && data.info.labels)
        fail(`Schematic file can only have data.info.labels or data.info.tags.labels, not both`);
    const tags = {
        name: data.info.name,
        description: data.info.description,
        labels: JSON.stringify(data.info.labels) ?? `[]`,
        ...data.info.tags
    };
    const tiles = data.tiles.grid.map((row, reversedY) => row.map((tile, x) => getBlockData(tile, data, x, height - reversedY - 1, schematicConsts)));
    return new Schematic(height, width, 1, tags, [], Schematic.unsortTiles(tiles));
}
