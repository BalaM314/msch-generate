import { Validator } from "jsonschema";
import { BlockConfig, BlockConfigType, Schematic, Tile, Item, Point2 } from "msch";
import { err } from "./funcs.js";
import { TileConfigType } from "./types.js";
function getBlockData(name, data) {
    let config = data.tiles.blocks[name];
    if (!config)
        throw new Error(`No data for block \`${name}\`.`);
    return new Tile(config.id, -1, -1, getBlockConfig(config, data));
}
;
function getLinks(config, data) {
    // return config.links.map(link =>
    // 	data.tiles.blocks[link] ?? (() => {throw new Error(`Unknown link ${link}`)})
    // );
    return []; //TODO implement
}
function getBlockConfig(config, data) {
    if (!config.config)
        return BlockConfig.null;
    if (!data)
        throw new Error("data is undefined");
    switch (config.config.type) {
        case TileConfigType.item:
            return new BlockConfig(BlockConfigType.content, [0, Item[config.config.value] ?? err(`Unknown item ${config.config.value}`)]);
        case TileConfigType.point:
            return new BlockConfig(BlockConfigType.point, new Point2(+config.config.value.split(/, ?/)[0], +config.config.value.split(/, ?/)[1]));
        case TileConfigType.program:
            let program = data.tiles.programs[config.config.value];
            if (program == undefined)
                throw new Error(`Unknown program ${program}`);
            if (typeof program == "string") {
                throw new Error(`External programs not yet implemented.`);
            }
            else if (program instanceof Array) {
                return new BlockConfig(BlockConfigType.bytearray, Tile.compressLogicConfig({
                    links: getLinks(config, data),
                    code: program
                }));
            }
            else {
                throw new Error(`Program ${program} is of invalid type. Valid types: string[], string`);
            }
    }
}
function buildSchematic(rawData, schema) {
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
        let tiles = data.tiles.grid.map(row => row.map(tile => getBlockData(tile, data)));
        return new Schematic(width, height, 1, tags, [], Schematic.unsortTiles(tiles));
    }
    catch (err) {
    }
}
