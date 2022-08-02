import { Schema, Validator } from "jsonschema";
import { BlockConfig, BlockConfigType, Schematic, Tile, Item, Point2, Link } from "msch";
import { err } from "./funcs.js";
import { SchematicBlockConfig, SchematicData, TileConfigType } from "./types.js";

const powerNodes = ["power-node", "power-node-large", "power-source", "surge-tower"]

function getBlockData(name:string, data:SchematicData, blockX:number, blockY:number):Tile|null {
	if(name == "") return null;
	let config = data.tiles.blocks[name];
	if(!config) throw new Error(`No data for block \`${name}\`.`);
	return new Tile(config.id, blockX, blockY, getBlockConfig(config, data, blockX, blockY), config.rotation ?? 0);
};

function getLinks(config:SchematicBlockConfig, data:SchematicData, blockX:number, blockY:number):Link[] {
	if(!config.links) return [];
	return config.links.map(link =>
		data.tiles.grid
		.slice().reverse() //Reverse the rows so that row 0 is at y position 0 instead of (height - y - 1)
		.map((row, y:number) =>
			row
			.map((block, x) => [block, x] as [block:string, x:number])
			.filter(([block, x]) => block == link)
			.map(([block, x]) => ({
				x: x - blockX,
				y: y - blockY,
				name: block + `WIP_${x}-${y}` //TODO allow specifying the name
			}))
		).reduce((accumulator:Link[], val:Link[]) => accumulator.concat(val), [])
	).reduce((accumulator:Link[], val:Link[]) => accumulator.concat(val), []);
	//TODO test
}

function getBlockConfig(config:SchematicBlockConfig, data:SchematicData, blockX:number, blockY:number):BlockConfig {
	if(!config.config) return BlockConfig.null;
	if(!data) throw new Error("data is undefined");
	if(config.links && powerNodes.includes(config.id)){
		return new BlockConfig(BlockConfigType.pointarray, getLinks(config, data, blockX, blockY).map(link => new Point2(link.x, link.y)))
	}
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
			if(!(config.config.value in data.tiles.programs)){
				throw new Error(`Unknown program ${config.config.value}`);
			}
			let program = data.tiles.programs[config.config.value];
			let code:string[];
			if(typeof programName == "string"){
				code = getProgramFromFile(program);
			} else if(programName instanceof Array){
				code = program;
			} else {
				throw new Error(`Program ${program} is of invalid type. (${typeof programName}) Valid types: string[], string`);
			}
			return new BlockConfig(BlockConfigType.bytearray, Tile.compressLogicConfig({
				links: getLinks(config, data, blockX, blockY),
				code
			}));
		default:
			throw new Error(`Invalid config type ${config.config.type}`);
	}
}

function getProgramFromFile(path:string):string[] {
	if(path.endsWith(".mlogx")){
		console.warn("Automatically compiling mlogx files before building is not yet implemented.");
		let mlogPath = path.slice(0, -1);
		if(!fs.existsSync(mlogPath) || !fs.lstatSync(mlogPath).isFile()){
			throw new Error(`Path "${mlogPath}" is not a file.`);
		}
		return fs.readFileSync(mlogPath, 'utf-8').split(/\r?\n/g);
	}
	if(!fs.existsSync(path)){
		throw new Error(`Path "${path}" does not exist.`);
	}
	if(!fs.lstatSync(path).isFile()){
		throw new Error(`Path "${path}" is not a file.`);
	}
	return fs.readFileSync(path, 'utf-8').split(/\r?\n/g);

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

