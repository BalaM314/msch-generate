/**
 * WIP
 */
import { Application } from "cli-app";
import * as fs from "fs";
import { Schematic } from "msch"; // tslint:disable-line
import path from "path";
import { buildSchematic } from "./buildSchematic.js";
const mschGenerate = new Application("msch-generate", "Mindustry schematic generator and parser.");
mschGenerate.command("manipulate", "Manipulates a schematic.", (opts, app) => {
    let schem = Schematic.blank;
    if (opts.namedArgs["read"]) {
        try {
            schem = Schematic.from(fs.readFileSync(opts.namedArgs["read"]));
        }
        catch (err) {
            console.error("Invalid schematic.", err);
            return 1;
        }
        schem.display("verbose" in opts.namedArgs);
        schem.tags["description"] = "Made with https://github.com/BalaM314/msch";
    }
    if ("interactive" in opts.namedArgs) {
        console.log("Interactive JavaScript shell, type .exit or Ctrl+C to exit.");
        console.log("The schematic variable is \`schem\`.");
        let help = "Type .help for help.";
        process.stdout.write("\n> ");
        process.stdin.on("data", (data) => {
            let line = data.toString().split(/\r?\n/g)[0];
            if (line.startsWith(".")) {
                if (line == ".exit") {
                    process.exit(0);
                }
                else if (line.startsWith(".output")) {
                    if (line.split(".output ")[1]) {
                        let outputPath = line.split(".output")[1]?.endsWith(".msch") ? line.split(".output")[1] : line.split(".output")[1] + ".msch";
                        fs.writeFileSync(outputPath, schem.write().toBuffer());
                        console.log(`Wrote modified file to ${outputPath}.`);
                    }
                    else {
                        console.log(`Usage: .output <filename>`);
                    }
                }
                else if (line.startsWith(".name")) {
                    if (line.split(".name ")[1]) {
                        schem.tags["name"] = line.split(".name ")[1];
                        console.log(`Set name to ${line.split(".name ")[1]}`);
                    }
                    else {
                        console.log(`Usage: .name <name>`);
                    }
                }
                else if (line.startsWith(".description")) {
                    if (line.split(".description ")[1]) {
                        schem.tags["description"] = line.split(".description ")[1];
                        console.log(`Set description to ${line.split(".description ")[1]}`);
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
                    console.log(eval(line)); //OH NO ITS NOT SAFE
                }
                catch (err) {
                    console.error(err);
                }
            }
            process.stdout.write("\n> ");
        });
    }
}, true, {
    namedArgs: {
        read: {
            description: "The path to the file to load as a schematic.",
        },
        verbose: {
            description: "Whether to be verbose when displaying the loaded schematic. WARNING: may spam console.",
            needsValue: false
        },
        output: {
            description: "The path to the output file."
        },
        interactive: {
            description: "Starts a shell, allowing you to edit the schematic by typing JS code.",
            needsValue: false
        }
    },
    positionalArgs: []
});
mschGenerate.command("build", "Builds a schematic.", (opts, app) => {
    const target = opts.positionalArgs[0];
    if (!fs.existsSync(target)) {
        console.error(`Filepath ${target} does not exist.`);
        return;
    }
    const data = fs.readFileSync(target, "utf-8");
    const schemaPath = path.join(app.sourceDirectory, "docs/msch-v1.schema.json");
    let schema;
    if (!fs.existsSync(schemaPath)) {
        throw new Error("JSON schema file does not exist. This was likely caused by an improper or corrupt installation.");
    }
    try {
        schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    }
    catch (err) {
        throw new Error("JSON schema file is invalid. This was likely caused by an improper or corrupt installation.");
    }
    console.log("Building schematic...");
    const schem = buildSchematic(data, schema);
    if (schem) {
        console.log(`Built schematic.`);
        schem.display(false);
        const outputPath = opts.namedArgs["output"] ?? opts.positionalArgs[0].replace(/\S(.json)?$/, ".msch");
        console.log(`Writing to ${outputPath}...`);
        fs.writeFileSync(outputPath, schem.write().toBuffer());
        console.log("Done!");
    }
}, false, {
    namedArgs: {
        output: {
            description: "Output file location"
        }
    },
    positionalArgs: [{
            name: "file",
            description: "The JSON file to build"
        }]
});
mschGenerate.run(process.argv);
