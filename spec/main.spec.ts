import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { mschGenerate } from "../build/index.js";

const cwd = path.dirname(fileURLToPath(import.meta.url));
console.log(path.join(cwd, "../build/index.js"));
process.chdir(cwd);
function runMsch(...args:string[]){
	mschGenerate.run(["node", path.join(cwd, "../build/index.js"), ...args], {throwOnError: true});
}



describe("msch build", () => {
	for(const filename of fs.readdirSync("sample-input").filter(f => f.endsWith(".json"))){
		it(`should parse file ${filename} and produce a binary`, () => {
			const filepath = path.join(os.tmpdir(), `msch-generate-test-build-${filename}`);
			try {
				fs.rmSync(filepath);
			} catch {}
			runMsch("build", path.join(cwd, "sample-input", filename), "--output", filepath);
			fs.accessSync(filepath, fs.constants.R_OK);
		});
	}
});

describe("msch init", () => {
	it(`should create a new schematic file that is valid JSON`, () => {
		const filepath = path.join(os.tmpdir(), "msch-generate-test-init.json");
		runMsch(
			"init",
			"--name",
			"NAME",
			filepath
		);
		const data = fs.readFileSync(filepath, "utf-8");
		expect(() => JSON.parse(data)).not.toThrow();
	});
});

describe("msch manipulate", () => {
	for(const filename of fs.readdirSync("sample-binaries").filter(f => f.endsWith(".msch"))){
		it(`should be able to read the binary file ${filename}`, () => {
			runMsch("manipulate", path.join(cwd, "sample-binaries", filename));
		});
	}
});
