#!/usr/bin/env node
/*
Copyright © <BalaM314>, 2024.
This file is part of msch-generate
msch-generate is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
msch-generate is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more details.
You should have received a copy of the GNU Lesser General Public License along with msch-generate. If not, see <https://www.gnu.org/licenses/>.
*/
import { Application } from "cli-app";
import * as fs from "fs";
import { Schema } from "jsonschema";
import { Schematic, Tile, Point2, TypeIO, BlockConfig, BlockConfigType } from "msch"; // tslint:disable-line
import path from "path";
import { buildSchematic } from "./buildSchematic.js";
import { parseIcons, tryRunOr } from "./funcs.js";

export const mschGenerate = new Application("msch-generate", "Mindustry schematic generator and parser.");
mschGenerate.command("manipulate", "Manipulates a schematic.", (opts, app) => {
	let schem:Schematic = Schematic.blank;
	schem.tags["description"] = "Made with https://github.com/BalaM314/msch-generate";
	
	if(opts.namedArgs["read"]){
		const result = Schematic.read(fs.readFileSync(opts.namedArgs["read"]));
		if(typeof result == "string"){
			console.error("Invalid schematic.", result);
			return 1;
		}
		schem = result;
		schem.display("verbose" in opts.namedArgs);
		schem.tags["description"] ??= "Made with https://github.com/BalaM314/msch-generate";
	}
	if("interactive" in opts.namedArgs){
		console.log("Interactive JavaScript shell, type .exit or Ctrl+C to exit.");
		console.log("The schematic variable is \`schem\`.");
		let help = "Type .help for help.";
		process.stdout.write("\n> ");
		process.stdin.on("data", (data) => {
			let line = data.toString().split(/\r?\n/g)[0];
			if(line.startsWith(".")){
				if(line == ".exit"){
					process.exit(0);
				} else if(line == ".help"){
					console.log(
`List of all available commands:
	.exit	Exits the program.
	.help Diplays this help information.
	.output Writes the schematic to the specified file name.
	.name Sets the name of the schematic.
	.description Sets the description of the schematic.`
					);
				} else if(line.startsWith(".output")){
					if(line.split(".output ")[1]){
						let outputPath = line.split(".output ")[1]?.endsWith(".msch") ? line.split(".output ")[1] : line.split(".output ")[1] + ".msch";
						fs.writeFileSync(outputPath, schem.write().toBuffer());
						console.log(`Wrote modified file to ${outputPath}.`);
					} else {
						console.log(`Usage: .output <filename>`)
					}
				} else if(line.startsWith(".name")){
					if(line.split(".name ")[1]){
						schem.tags["name"] = line.split(".name ")[1];
						console.log(`Set name to ${line.split(".name ")[1]}`);
					} else {
						console.log(`Usage: .name <name>`)
					}
				} else if(line.startsWith(".description")){
					if(line.split(".description ")[1]){
						schem.tags["description"] = line.split(".description ")[1];
						console.log(`Set description to ${line.split(".description ")[1]}`);
					} else {
						console.log(`Usage: .description <description>`)
					}
				} else {
					console.log("Invalid command.");
				}
			} else {
				try {
					console.log(eval(line));
					//this line uses eval
					//which could potentially lead to an arbitrary code execution vulnerability
					//ive tried to remove it but the feature just doesnt work without it
				} catch(err){
					console.error(err);
				}
			}
			process.stdout.write("\n> ");
		})
	}
}, true, {
	positionalArgCountCheck: "warn",
	namedArgs: {
		read: {
			description: "The path to the file to load as a schematic.",
			aliases: ["r"],
		},
		verbose: {
			description: "Whether to be verbose when displaying the loaded schematic. WARNING: may spam console.",
			needsValue: false,
			aliases: ["v"],
		},
		output: {
			description: "The path to the output file.",
			aliases: ["o"],
		},
		interactive: {
			description: "Starts a shell, allowing you to edit the schematic by typing JS code.",
			needsValue: false,
			aliases: ["i"]
		}
	},
	positionalArgs: []
}, ["m"]);
mschGenerate.command("build", "Builds a schematic.", (opts, app) => {
	const target:string = opts.positionalArgs[0];
	if(!fs.existsSync(target)){
		console.error(`Filepath ${target} does not exist.`);
		return;
	}
	const data:string = fs.readFileSync(target, "utf-8");
	const schemaPath:string = path.join(app.sourceDirectory, "docs/msch-v1.schema.json");
	const iconsPath:string = path.join(app.sourceDirectory, "cache/icons.properties");
	let schema:Schema;
	if(!fs.existsSync(schemaPath)){
		throw new Error("JSON schema file does not exist. This was likely caused by an improper or corrupt installation.");
	}
	if(!fs.existsSync(iconsPath)){
		throw new Error("Icons file does not exist. This was likely caused by an improper or corrupt installation.");
	}
	try {
		schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
	} catch(err){
		throw new Error("JSON schema file is invalid. This was likely caused by an improper or corrupt installation.");
	}
	const icons = parseIcons(fs.readFileSync(iconsPath, 'utf-8').split(/\r?\n/g));
	console.log("Building schematic...");
	//Use the schematic file as the working directory, to correctly resolve relative paths
	const cwd = process.cwd();
	process.chdir(path.join(target, ".."));
	tryRunOr(() => {
		const schem = buildSchematic(data, schema, icons);
		process.chdir(cwd);
		console.log(`Built schematic.`);
		schem.display(false);
		const outputPath = opts.namedArgs["output"] ?? opts.positionalArgs[0].replace(/(.json)?$/, ".msch");
		console.log(`Writing to ${outputPath}...`);
		fs.writeFileSync(outputPath, schem.write().toBuffer());
		console.log("Done!");
	}, e => {
		console.error(`Error: ${e.message}\nBuild failed.`);
		process.exit(1);
	});

}, true, {
	namedArgs: {
		output: {
			description: "Output file location",
			aliases: ["o"],
		}
	},
	positionalArgs: [{
		name: "file",
		description: "The JSON file to build"
	}],
	positionalArgCountCheck: "warn",
}, ["b"]);
mschGenerate.command("init", "Creates a JSON schematic file.", (opts, app) => {
	const jsonData = {
		"$schema": "https://raw.githubusercontent.com/BalaM314/msch-generate/main/docs/msch-v1.schema.json",
		info: {
			name: opts.namedArgs.name,
			description: opts.namedArgs.description ?? "No description provided.\nGenerated with https://github.com/BalaM314/msch-generate",
			authors: [...(opts.namedArgs.authors ?? "Unknown").split(/, ?/)],
			version: "1.0.0"
		},
		tiles: {
			grid: [
				["holyBlock"]
			],
			blocks: {
				holyBlock: {
					id: "router"
				}
			},
			programs: {

			}
		},
		consts: {

		}
	};
	const outputJSON = JSON.stringify(jsonData, undefined, `\t`);
	console.log(`Writing JSON data to ${opts.positionalArgs[0]}`);
	fs.writeFileSync(opts.positionalArgs[0], outputJSON, "utf-8");
}, false, {
	namedArgs: {
		name: {
			description: "Project name",
			required: true,
			aliases: ["n"],
		},
		description: {
			description: "Project description",
			aliases: ["d"],
		},
		authors: {
			description: "Project authors",
			aliases: ["a"],
		},
	},
	positionalArgs: [{
		name: "file",
		description: "The path of the JSON file to create",
		required: true,
	}],
	positionalArgCountCheck: "warn",
}, ["i"]);

mschGenerate.run(process.argv);
