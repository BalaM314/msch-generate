#!/usr/bin/env node
/*
Copyright © <BalaM314>, 2024.
This file is part of msch-generate
msch-generate is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
msch-generate is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more details.
You should have received a copy of the GNU Lesser General Public License along with msch-generate. If not, see <https://www.gnu.org/licenses/>.
*/
import fs from "node:fs/promises";
import path from "node:path";
import os from "os";
import { Application, arg } from "@balam314/cli-app";
import { Schematic, MessageError } from "msch";
import { buildSchematic } from "./buildSchematic.js";
import { crash, escapePUA, fail, parseIcons, removeParams, sanitizeFilename } from "./funcs.js";
function getStorePath() {
    return (process.platform == "win32" ? path.join(process.env["APPDATA"], "Mindustry/schematics") :
        process.platform == "darwin" ? path.join(os.homedir(), "/Library/Application Support/Mindustry/schematics") :
            process.platform == "linux" ? path.join((process.env["XDG_DATA_HOME"] ?? path.join(os.homedir(), "/.local/share")), "/Mindustry/schematics") :
                fail(`Unsupported platform ${process.platform}`));
}
export const mschGenerate = new Application("msch-generate", "Mindustry schematic generator and parser.");
mschGenerate.command("manipulate", "Manipulates a schematic.").aliases("m").args({
    positionalArgCountCheck: "error",
    namedArgs: {
        read: arg().description("The path to the file to load as a schematic.")
            .optional().aliases("r"),
        verbose: arg().description("Whether to be verbose when displaying the loaded schematic. WARNING: may spam console.")
            .valueless().aliases("v"),
        interactive: arg().description("Starts a shell, allowing you to edit the schematic by typing JS code.")
            .valueless().aliases("i")
    },
    positionalArgs: []
}).impl(async (opts, app) => {
    let schem = Schematic.blank;
    schem.tags["description"] = "Made with https://github.com/BalaM314/msch-generate";
    if (opts.namedArgs.read) {
        try {
            const result = Schematic.read(await fs.readFile(opts.namedArgs.read));
            if (typeof result == "string") {
                console.error("Invalid schematic.", result);
                return 1;
            }
            schem = result;
            schem.display(opts.namedArgs.verbose);
            schem.tags["description"] ??= "Made with https://github.com/BalaM314/msch-generate";
        }
        catch (err) {
            if (err instanceof MessageError) {
                console.error(`Invalid schematic: ${err.message}`);
            }
        }
    }
    if (opts.namedArgs.interactive) {
        console.log("Interactive JavaScript shell, type .exit or Ctrl+C to exit.");
        console.log(`The schematic variable is "schem".`);
        const help = "Type .help for help.";
        process.stdout.write("\n> ");
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        process.stdin.on("data", async (data) => {
            const line = data.toString().split(/\r?\n/g)[0];
            if (line.startsWith(".")) {
                if (line == ".exit") {
                    process.exit(0);
                }
                else if (line == ".help") {
                    console.log(`List of all available commands:
	.exit	Exits the program.
	.help Diplays this help information.
	.output Writes the schematic to the specified file name.
	.name Sets the name of the schematic.
	.description Sets the description of the schematic.`);
                }
                else if (line.startsWith(".output")) {
                    const outFile = line.split(".output ")[1];
                    if (outFile) {
                        const outputPath = outFile.endsWith(".msch") ? outFile : outFile + ".msch";
                        await fs.writeFile(outputPath, schem.write().toBuffer());
                        console.log(`Wrote modified file to ${outputPath}.`);
                    }
                    else {
                        console.log(`Usage: .output <filename>`);
                    }
                }
                else if (line.startsWith(".name")) {
                    const name = line.split(".name ")[1];
                    if (name) {
                        schem.tags["name"] = name;
                        console.log(`Set name to ${name}`);
                    }
                    else {
                        console.log(`Usage: .name <name>`);
                    }
                }
                else if (line.startsWith(".description")) {
                    const description = line.split(".description ")[1];
                    if (description) {
                        schem.tags["description"] = description;
                        console.log(`Set description to ${description}`);
                    }
                    else {
                        console.log(`Usage: .description <description>`);
                    }
                }
                else {
                    console.log("Invalid command.");
                }
            }
            else {
                try {
                    console.log(eval(line));
                }
                catch (err) {
                    console.error(err);
                }
            }
            process.stdout.write("\n> ");
        });
    }
});
mschGenerate.command("build", "Builds a schematic.").default().aliases("b").args({
    namedArgs: {
        output: arg().optional().description("Output file location").aliases("o"),
        "no-show": arg().valueless().description(`Suppresses displaying the schematic.`).aliases("n"),
        "verbose": arg().valueless().description(`Displays more information about the schematic.`).aliases("v"),
    },
    positionalArgs: [{
            name: "file",
            description: "The JSON file to build"
        }],
    positionalArgCountCheck: "warn",
}).impl(async (opts, app) => {
    const target = opts.positionalArgs[0];
    let data;
    try {
        data = await fs.readFile(target, "utf-8");
    }
    catch {
        console.error(`Filepath ${target} does not exist or cannot be read.`);
        return 1;
    }
    const schemaPath = path.join(app.sourceDirectory, "..", "docs/msch-v1.schema.json");
    const iconsPath = path.join(app.sourceDirectory, "..", "cache/icons.properties");
    const iconsText = await fs.readFile(iconsPath, 'utf-8').catch(() => crash(`Icons file does not exist. This was likely caused by an improper or corrupt installation. (Expected location: ${iconsPath})`));
    const schemaText = await fs.readFile(schemaPath, "utf8").catch(() => crash(`JSON schema file does not exist. This was likely caused by an improper or corrupt installation. (Expected location: ${schemaPath})`));
    let schema;
    try {
        schema = JSON.parse(schemaText);
    }
    catch {
        crash("JSON schema file is invalid. This was likely caused by an improper or corrupt installation.");
    }
    const icons = parseIcons(iconsText.split(/\r?\n/g));
    console.log("Building schematic...");
    //Use the schematic file as the working directory, to correctly resolve relative paths
    const cwd = process.cwd();
    process.chdir(path.join(target, ".."));
    const schem = buildSchematic(data, schema, icons);
    process.chdir(cwd);
    console.log(`Built schematic.`);
    if (!opts.namedArgs["no-show"])
        schem.display(opts.namedArgs.verbose);
    const outputPath = opts.namedArgs.output ?? target.replace(/(.json)?$/, ".msch");
    console.log(`Writing to ${outputPath}...`);
    await fs.writeFile(outputPath, schem.write().toBuffer());
    console.log("Done!");
});
mschGenerate.command("init", "Creates a JSON schematic file.").args({
    namedArgs: {
        name: arg().optional().description("Project name").aliases("n"),
        description: arg().optional().description("Project description").aliases("d", "desc"),
        authors: arg().optional().description("Project authors").aliases("author", "a"),
    },
    positionalArgs: [{
            name: "file",
            description: "The path of the JSON file to create",
        }],
    positionalArgCountCheck: "warn",
}).impl(async (opts, app) => {
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
            programs: {}
        },
        consts: {}
    };
    const outputJSON = JSON.stringify(jsonData, undefined, `\t`);
    console.log(`Writing JSON data to ${opts.positionalArgs[0]}`);
    await fs.writeFile(opts.positionalArgs[0], outputJSON, "utf-8");
});
mschGenerate.category("store", "Commands that manage Mindustry's schematic folder.", store => {
    store.command("count", "Displays the number of schematics you have installed.").args({}).impl(async () => {
        console.log((await fs.readdir(getStorePath())).length);
    });
    store.command("path", "Outputs the path to your schematics folder.").args({}).impl(() => {
        console.log(getStorePath());
    });
    store.command("list", "Prints information about each of your installed schematics.").args({
        namedArgs: {
            "name-length": arg().description("Max length for a schematic name.").default("25"),
            tags: arg().description("Show all tag information.").valueless(),
            filename: arg().description("Whether to use the filename instead of the schematic's name.").valueless(),
        }
    }).impl(async (opts) => {
        const storePath = getStorePath();
        const schematics = (await Promise.all((await fs.readdir(storePath))
            .map(async (filename) => [filename, await fs.readFile(path.join(storePath, filename))]))).map(([filename, data]) => [filename, Schematic.read(data)]);
        for (const [filename, schem] of schematics) {
            if (typeof schem == "string") {
                console.log(`${filename}\t\tError: ${schem}`);
            }
            else {
                let nameMaxLength = Number(opts.namedArgs["name-length"]);
                if (isNaN(nameMaxLength))
                    nameMaxLength = 25;
                console.log([
                    (opts.namedArgs.filename ?
                        filename.split(/.msch$/)[0]
                        : escapePUA(schem.tags["name"] ?? `<schematic name missing>`)).slice(0, nameMaxLength).padEnd(nameMaxLength, " "),
                    `(${schem.width}x${schem.height})`.padEnd(7, " "),
                    escapePUA(schem.tags["description"] ?? `<no description>`).replace(/\r?\n/g, "\\n"),
                    opts.namedArgs.tags && `Tags: ${escapePUA(JSON.stringify(removeParams(schem.tags, "name", "description")))}`
                ].filter(Boolean).join(" "));
            }
        }
    });
    store.command("normalize", "Normalizes the filenames of your installed schematics.").args({
        namedArgs: {
            quiet: arg().description("Suppresses printing the full list of renames.").valueless(),
        }
    }).impl(async (opts) => {
        function giveUp() {
            console.log(`Something went horribly wrong, please try to fix the directory structure at ${storePath}`);
            process.exit(666);
        }
        const storePath = getStorePath();
        const storeBackupPath = path.join(storePath, "..", "schematics_backup");
        const tempStorePath = path.join(storePath, "..", "schematics_temp_");
        //Make a backup if it doesn't exist
        try {
            await fs.access(storeBackupPath);
        }
        catch {
            await fs.cp(storePath, storeBackupPath, {
                recursive: true,
                errorOnExist: true,
            }).catch((err) => {
                console.log(err);
                fail(`Failed to make a backup of the schematics directory.`);
            });
        }
        //Check for the existence of the store files
        await fs.access(storePath, fs.constants.W_OK).catch(async () => {
            try {
                await fs.access(tempStorePath, fs.constants.W_OK);
                //schematics doesn't exist, but schematics_temp_ does and is a directory
                await fs.rename(tempStorePath, storePath).catch(giveUp);
            }
            catch (err) {
                fail(`Mindustry schematics path at ${storePath} does not exist.`);
            }
        });
        const schematics = (await Promise.all((await fs.readdir(storePath))
            .map(filename => [filename, path.join(storePath, filename)])
            .map(async ([filename, filepath]) => [filename, filepath, await fs.readFile(filepath)]))).map(([filename, filepath, data]) => {
            let result = Schematic.read(data, 1024);
            if (result instanceof Schematic && !result.tags["name"])
                result = `Name is missing or empty`;
            if (typeof result == "string")
                fail(`Schematic at ${filepath} is invalid: ${result}\nPlease move or delete it.`);
            return [filename, filepath, result];
        });
        //Make sure there are no duplicates
        const newFilenames = new Map();
        const operations = schematics.map(([filename, filepath, schem]) => {
            const schemName = schem.tags["name"];
            const cleanedSchemName = sanitizeFilename(schemName);
            if (newFilenames.has(cleanedSchemName)) {
                const otherSchemName = newFilenames.get(cleanedSchemName);
                if (otherSchemName == schemName) {
                    fail(`Multiple schematics exist with the name ${escapePUA(schemName)}`);
                }
                else {
                    fail(`Multiple schematics exist with a name that corresponds to the filename ${cleanedSchemName}\nPlease rename one of the schematics "${otherSchemName}", "${schemName}"`);
                }
            }
            newFilenames.set(cleanedSchemName, schemName);
            return [filename, cleanedSchemName + ".msch"];
        });
        const newPaths = operations.map(x => x[1]);
        if (new Set(newPaths).size != newPaths.length)
            crash(`logic error`);
        const filesToMove = operations.filter(([oldName, newName]) => oldName != newName).length;
        if (filesToMove == 0) {
            console.log(`${schematics.length}/${schematics.length} files have the correct name.`);
            return 0;
        }
        console.log(`${schematics.length - filesToMove}/${schematics.length} files have the correct name. Renaming ${filesToMove} files...`);
        if (!opts.namedArgs.quiet) {
            console.log(operations.map(([from, to]) => `${from} -> ${to}`).join("\n"));
        }
        try {
            await fs.access(tempStorePath);
            //temp store path exists
            const numFiles = (await fs.readdir(tempStorePath).catch(giveUp)).length;
            if (numFiles == 0) {
                //empty, safe to delete
                await fs.rmdir(tempStorePath).catch(giveUp);
            }
            else {
                giveUp();
            }
        }
        catch { }
        await fs.rename(storePath, tempStorePath).catch(() => {
            fail(`Could not move the schematics directory. Make sure Mindustry is closed.`);
        });
        await fs.mkdir(storePath);
        await Promise.all(operations.map(([from, to]) => fs.rename(path.join(tempStorePath, from), path.join(storePath, to))));
        //everything succeeded, safe to delete the temp directory
        await fs.rm(tempStorePath, { recursive: true });
        console.log(`Done.`);
    });
});
