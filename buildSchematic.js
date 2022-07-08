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
        name: block + `WIP_${x}-${y}` //TODO allow specifying the name
    }))).reduce((accumulator, val) => accumulator.concat(val), [])).reduce((accumulator, val) => accumulator.concat(val), []);
    //TODO test
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
            let program = data.tiles.programs[config.config.value];
            if (program == undefined)
                throw new Error(`Unknown program ${program}`);
            if (typeof program == "string") {
                throw new Error(`External programs not yet implemented.`);
            }
            else if (program instanceof Array) {
                return new BlockConfig(BlockConfigType.bytearray, Tile.compressLogicConfig({
                    links: getLinks(config, data, blockX, blockY),
                    code: program
                }));
            }
            else {
                throw new Error(`Program ${program} is of invalid type. Valid types: string[], string`);
            }
        default:
            throw new Error(`Invalid config type ${config.config.type}`);
    }
}
export function buildSchematic(rawData, schema) {
    const jsonschem = new Validator();
    try {
        let data = JSON.parse(rawData);
        jsonschem.validate(data, schema, {
            throwAll: true
        });
        let width = data.tiles.grid.map(row => row.length).sort().at(-1) ?? 0;
        let height = data.tiles.grid.length;
        let tags = {
            name: data.info.name,
            description: data.info.description ?? "No description provided.",
            ...data.info.tags
        };
        let tiles = data.tiles.grid.map((row, reversedY) => row.map((tile, x) => getBlockData(tile, data, x, height - reversedY - 1)));
        return new Schematic(width, height, 1, tags, [], Schematic.unsortTiles(tiles));
    }
    catch (err) {
        console.error("Failed to build schematic:");
        console.error(err);
    }
}
