import * as fs from "fs";
import { Validator } from "jsonschema";
import { BlockConfig, BlockConfigType, Schematic, Tile, Item, Point2 } from "msch";
import { err } from "./funcs.js";
import { TileConfigType } from "./types.js";
const powerNodes = ["power-node", "power-node-large", "power-source", "surge-tower"];
function getBlockData(name, data, blockX, blockY) {
    if (name == "")
        return null;
    let config = data.tiles.blocks[name];
    if (!config)
        throw new Error(`No data for block \`${name}\`.`);
    return new Tile(config.id, blockX, blockY, getBlockConfig(config, data, blockX, blockY), config.rotation ?? 0);
}
;
function getLinks(config, data, blockX, blockY) {
    if (!config.links)
        return [];
    return config.links.map(link => data.tiles.grid
        .slice().reverse() //Reverse the rows so that row 0 is at y position 0 instead of (height - y - 1)
        .map((row, y) => row
        .map((block, x) => [block, x])
        .filter(([block, x]) => block == link)
        .map(([block, x]) => ({
        x: x - blockX,
        y: y - blockY,
        name: `!!`
    }))).reduce((accumulator, val) => accumulator.concat(val), [])).reduce((accumulator, val) => accumulator.concat(val), []);
}
function getBlockConfig(config, data, blockX, blockY) {
    if (!config.config)
        return BlockConfig.null;
    if (!data)
        throw new Error("data is undefined");
    if (config.links && powerNodes.includes(config.id)) {
        return new BlockConfig(BlockConfigType.pointarray, getLinks(config, data, blockX, blockY).map(link => new Point2(link.x, link.y)));
    }
    switch (config.config.type) {
        case TileConfigType.item:
            return new BlockConfig(BlockConfigType.content, [0, Item[config.config.value] ?? err(`Unknown item ${config.config.value}`)]);
        case TileConfigType.boolean:
            return new BlockConfig(BlockConfigType.boolean, config.config.value == "false" ? false : true);
        case TileConfigType.point:
            return new BlockConfig(BlockConfigType.point, new Point2(+config.config.value.split(/, ?/)[0], +config.config.value.split(/, ?/)[1]));
        case TileConfigType.string:
            return new BlockConfig(BlockConfigType.string, config.config.value);
        case TileConfigType.program:
            if (!(config.config.value in data.tiles.programs)) {
                throw new Error(`Unknown program ${config.config.value}`);
            }
            let program = data.tiles.programs[config.config.value];
            let code;
            if (typeof program == "string") {
                code = getProgramFromFile(program);
            }
            else if (program instanceof Array) {
                code = program;
            }
            else {
                throw new Error(`Program ${program} is of invalid type. (${typeof program}) Valid types: string[], string`);
            }
            return new BlockConfig(BlockConfigType.bytearray, Tile.compressLogicConfig({
                links: getLinks(config, data, blockX, blockY),
                code
            }));
        default:
            throw new Error(`Invalid config type ${config.config.type}`);
    }
}
function getProgramFromFile(path) {
    if (path.endsWith(".mlogx")) {
        console.warn("Automatically compiling mlogx files before building is not yet implemented.");
        let mlogPath = path.slice(0, -1);
        if (!fs.existsSync(mlogPath) || !fs.lstatSync(mlogPath).isFile()) {
            throw new Error(`Path "${mlogPath}" is not a file.`);
        }
        return fs.readFileSync(mlogPath, 'utf-8').split(/\r?\n/g);
    }
    if (!fs.existsSync(path)) {
        throw new Error(`Path "${path}" does not exist.`);
    }
    if (!fs.lstatSync(path).isFile()) {
        throw new Error(`Path "${path}" is not a file.`);
    }
    return fs.readFileSync(path, 'utf-8').split(/\r?\n/g);
}
function replaceConsts(text, consts) {
    const specifiedConsts = text.match(/(?<!\\\$\()(?<=\$\()[\w-.]+(?=\))/g);
    specifiedConsts?.forEach(key => {
        if (key in consts) {
            const value = consts[key];
            text = text.replace(`$(${key})`, value instanceof Array ? value.join(", ") : value);
        }
        else {
            console.warn(`Unknown compiler const ${key}`);
        }
    });
    if (!text.includes("$"))
        return text;
    for (const [key, value] of Object.entries(consts).sort((a, b) => b.length - a.length)) {
        text = text.replaceAll(`$${key}`, value instanceof Array ? value.join(", ") : value);
        if (!text.includes("$"))
            return text;
    }
    return text;
}
function replaceConstsInConfig(data, consts) {
    const compilerConsts = {
        name: data.info.name,
        version: data.info.version,
        authors: data.info.authors,
        ...data.consts,
        ...consts
    };
    return {
        info: {
            ...data.info,
            description: data.info.description ? replaceConsts(data.info.description, compilerConsts) : undefined
        },
        tiles: {
            grid: data.tiles.grid,
            programs: data.tiles.programs,
            blocks: Object.fromEntries(Object.entries(data.tiles.blocks)
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
    };
}
export function buildSchematic(rawData, schema, icons) {
    const jsonschem = new Validator();
    try {
        let data = JSON.parse(rawData);
        jsonschem.validate(data, schema, {
            throwAll: true
        });
        data = replaceConstsInConfig(data, {
            ...icons
        });
        const width = data.tiles.grid.map(row => row.length).sort().at(-1) ?? 0;
        const height = data.tiles.grid.length;
        const tags = {
            name: data.info.name,
            description: data.info.description,
            ...data.info.tags
        };
        const tiles = data.tiles.grid.map((row, reversedY) => row.map((tile, x) => getBlockData(tile, data, x, height - reversedY - 1)));
        return new Schematic(height, width, 1, tags, [], Schematic.unsortTiles(tiles));
    }
    catch (err) {
        console.error("Failed to build schematic:");
        console.error(err);
    }
}
