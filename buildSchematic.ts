import * as fs from "fs";
import path from "path";
import { Schema, Validator } from "jsonschema";
import { compileMlogxToMlog, CompilerConsts, getState, getLocalState, getSettings, CompilerError } from "mlogx";
import { BlockConfig, BlockConfigType, Schematic, Tile, Item, Point2, Link } from "msch";
import { crash } from "./funcs.js";
import { SchematicBlockConfig, SchematicData, TileConfigType } from "./types.js";
import { Options } from "cli-app";

const powerNodes = ["power-node", "power-node-large", "power-source", "surge-tower"];

function getBlockData(name:string, data:SchematicData, blockX:number, blockY:number, schematicConsts:CompilerConsts):Tile | null {
	if(name == "") return null;
	let config = data.tiles.blocks[name] ?? crash(`No data for block \`${name}\`.`);
	return new Tile(config.id, blockX, blockY, getBlockConfig(config, data, blockX, blockY, schematicConsts), config.rotation ?? 0);
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
				name: `!!` //Allow the game to determine it automatically
			}))
		).reduce((accumulator:Link[], val:Link[]) => accumulator.concat(val), [])
	).reduce((accumulator:Link[], val:Link[]) => accumulator.concat(val), [])
}



function getBlockConfig(config:SchematicBlockConfig, data:SchematicData, blockX:number, blockY:number, schematicConsts:CompilerConsts):BlockConfig {
	if(!config.config) return BlockConfig.null;
	if(!data) throw new Error("data is undefined");
	if(config.links && powerNodes.includes(config.id)){
		return new BlockConfig(BlockConfigType.pointarray, getLinks(config, data, blockX, blockY).map(link => new Point2(link.x, link.y)))
	}
	switch(config.config.type){
		case TileConfigType.item:
			return new BlockConfig(BlockConfigType.content, [0, Item[config.config.value as keyof typeof Item] ?? crash(`Unknown item ${config.config.value}`)]);
		case TileConfigType.boolean:
			return new BlockConfig(BlockConfigType.boolean, config.config.value == "false" ? false : true);
		case TileConfigType.point:
			return new BlockConfig(BlockConfigType.point, new Point2(+config.config.value.split(/, ?/)[0], +config.config.value.split(/, ?/)[1]));
		case TileConfigType.string:
			return new BlockConfig(BlockConfigType.string, config.config.value);
		case TileConfigType.program:
			if(!(config.config.value in data.tiles.programs)){
				throw new Error(`Unknown program "${config.config.value}"`);
			}
			let program = data.tiles.programs[config.config.value];
			let code:string[];
			if(typeof program == "string"){
				code = getProgramFromFile(program, schematicConsts);
			} else if(program instanceof Array){
				code = program;
			} else {
				throw new Error(`Program "${program}" is of invalid type. (${typeof program}) Valid types: string[], string`);
			}
			return new BlockConfig(BlockConfigType.bytearray, Tile.compressLogicConfig({
				links: getLinks(config, data, blockX, blockY),
				code
			}));
		default:
			throw new Error(`Invalid config type "${config.config.type}"`);
	}
}

function getProgramFromFile(path:string, schematicConsts:CompilerConsts):string[] {
	if(path.endsWith(".mlogx")){
		console.log(`Compiling prorgam ${path}`);
		return compileMlogxProgram(path, schematicConsts);
	}
	if(!fs.existsSync(path)){
		throw new Error(`Path "${path}" does not exist.`);
	}
	if(!fs.lstatSync(path).isFile()){
		throw new Error(`Path "${path}" is not a file.`);
	}
	return fs.readFileSync(path, 'utf-8').split(/\r?\n/g);

}

function compileMlogxProgram(filepath:string, schematicConsts:CompilerConsts):string[] {
	const data = fs.readFileSync(filepath, "utf-8").split(/\r?\n/g);
	const directory = path.join(filepath, "..");
	
	const settings = getSettings(directory, true);
	const globalState = getState(settings, directory, {
		namedArgs: {}
	} as Options);
	const state = getLocalState(globalState,
		path.extname(filepath),
		new Map(), //no need for icons, we already have them in schematicConsts
		schematicConsts,
	);
	
	try {
		return compileMlogxToMlog(
			data,
			state
		).outputProgram.map(s => s.text);
	} catch(err){
		if(err instanceof CompilerError){
			throw err;
		} else {
			console.error(`mlogx crashed!`);
			throw err;
		}
	}

};

function replaceConsts(text:string, consts:CompilerConsts):string {
	const specifiedConsts = text.match(/(?<!\\\$\()(?<=\$\()[\w-.]+(?=\))/g);
	specifiedConsts?.forEach(key => {
		const value = consts.get(key);
		if(value){
			text = text.replace(`$(${key})`, value instanceof Array ? value.join(", ") : value.toString());
		} else {
			console.warn(`Unknown compiler const ${key}`);
		}
	});
	if(!text.includes("$")) return text;
	for(const [key, value] of [...consts].sort((a, b) => b.length - a.length)){
		text = text.replaceAll(`$${key}`, value instanceof Array ? value.join(", ") : value.toString());
		if(!text.includes("$")) return text;
	}
	return text;
}

function getSchematicConsts(data:SchematicData, extraConsts:Record<string, string | string[]>):CompilerConsts {
	return new Map([
		["name", data.info.name],
		["version", data.info.version],
		["authors", data.info.authors],
		...Object.entries(data.consts),
		...Object.entries(extraConsts),
	]);
}

function replaceConstsInConfig(data:SchematicData, compilerConsts:CompilerConsts):SchematicData {
	
	return {
		info: {
			...data.info,
			name: replaceConsts(data.info.name, compilerConsts),
			description: data.info.description ? replaceConsts(data.info.description, compilerConsts) : undefined
		},
		tiles: {
			grid: data.tiles.grid,
			programs: data.tiles.programs,
			blocks: Object.fromEntries(
				Object.entries(data.tiles.blocks) //TODO no longer necessary in some cases
				.map(([name, blockData]) => ([name, {
					...blockData,
					id: replaceConsts(blockData.id, compilerConsts),
					config: blockData.config ? {
						type: blockData.config.type,
						value: replaceConsts(blockData.config.value, compilerConsts)
					} : undefined
				}]))
			)
		},
		consts: data.consts,
	};
}

export function buildSchematic(rawData:string, schema:Schema, icons: {
	[id: string]: string;
}):Schematic | undefined {
	const jsonschem = new Validator();
	try {
		let data:SchematicData = JSON.parse(rawData);
		const {valid, errors} = jsonschem.validate(data, schema);
		if(!valid) throw new Error(`Schematic file is invalid: ${errors[0].stack}`);
		const schematicConsts = getSchematicConsts(data, icons);
		data = replaceConstsInConfig(data, schematicConsts);

		const width = data.tiles.grid.map(row => row.length).sort().at(-1) ?? 0;
		const height = data.tiles.grid.length;
		
		const tags = {
			name: data.info.name,
			description: data.info.description!,
			...data.info.tags
		};
		const tiles:(Tile|null)[][] = data.tiles.grid.map((row, reversedY) =>
			row.map((tile, x) => 
				getBlockData(tile, data, x, height - reversedY - 1, schematicConsts)
			)
		);

		return new Schematic(height, width, 1, tags, [], Schematic.unsortTiles(tiles));
	} catch(err){
		console.error("Failed to build schematic:");
		console.error((err as Error).toString());
	}
}

