import { Schema, Validator } from "jsonschema";
import { BlockConfig, BlockConfigType, Schematic, Tile, Item, Point2, Link } from "msch";
import { err } from "./funcs.js";
import { SchematicBlockConfig, SchematicData, TileConfigType } from "./types.js";


function getBlockData(name:string, data:SchematicData, x:number, y:number):Tile|null {
	if(name == "") return null;
	let config = data.tiles.blocks[name];
	if(!config) throw new Error(`No data for block \`${name}\`.`);
	return new Tile(config.id, x, y, getBlockConfig(config, data));
};

function getLinks(config:SchematicBlockConfig, data:SchematicData, blockX:number, blockY:number):Link[] {
	return config.links.map(link =>
		data.tiles.grid
		.reverse() //Reverse the rows so that row 0 is at y position 0 instead of (height - y - 1)
		.map((row, y:number) =>
			row.filter(block => block == link)
			.map((block:string, x:number) => ({
				x: x - blockX,
				y: y - blockY,
				name: block
			}))
		)
	)//Array of the block configs of each item
	//TODO test
}

function getBlockConfig(config:SchematicBlockConfig, data:SchematicData):BlockConfig {
	if(!config.config) return BlockConfig.null;
	if(!data) throw new Error("data is undefined");
	switch(config.config.type){
		case TileConfigType.item:
			return new BlockConfig(BlockConfigType.content, [0, Item[config.config.value as keyof typeof Item] ?? err(`Unknown item ${config.config.value}`)]);
		case TileConfigType.boolean:
			return new BlockConfig(BlockConfigType.boolean, config.config.value == "false" ? false : true);
		case TileConfigType.point:
			return new BlockConfig(BlockConfigType.point, new Point2(+config.config.value.split(/, ?/)[0], +config.config.value.split(/, ?/)[1]));
		case TileConfigType.string:
			return new BlockConfig(BlockConfigType.string, config.config.value);
		case TileConfigType.program:
			let program = data.tiles.programs[config.config.value];
			if(program == undefined) throw new Error(`Unknown program ${program}`);
			if(typeof program == "string"){
				throw new Error(`External programs not yet implemented.`);
			} else if(program instanceof Array){
				return new BlockConfig(BlockConfigType.bytearray, Tile.compressLogicConfig({
					links: getLinks(config, data),
					code: program
				}));
			} else {
				throw new Error(`Program ${program} is of invalid type. Valid types: string[], string`);
			}
		default:
			throw new Error(`Invalid config type ${config.config.type}`);
	}
}

export function buildSchematic(rawData:string, schema:Schema){
	const jsonschem = new Validator();
	try {
		let data:SchematicData = JSON.parse(rawData);
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
		let tiles:(Tile|null)[][] = data.tiles.grid.map((row, reversedY) =>
			row.map((tile, x) => 
				getBlockData(tile, data, x, height - reversedY - 1)
			)
		);



		return new Schematic(width, height, 1, tags, [], Schematic.unsortTiles(tiles));
	} catch(err){
		console.error("Failed to build schematic:");
		console.error(err);
	}
}

