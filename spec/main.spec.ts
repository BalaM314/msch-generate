import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { mschGenerate } from "../build/index.js";

const cwd = path.dirname(fileURLToPath(import.meta.url));
process.chdir(cwd);
function runMsch(...args:string[]){
	mschGenerate.run(["node", path.join(cwd, "../build/index.js"), ...args], {throwOnError: true});
}



describe("msch build", () => {
	for(const filename of fs.readdirSync("sample-input")){
		it(`should parse file ${filename} and produce a binary`, () => {
			const filepath = path.join(os.tmpdir(), `msch-generate-test-build-${filename}.json`);
			runMsch("build", path.join(cwd, "sample-input", filename), "-o", filepath);
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
	for(const filename of fs.readdirSync("sample-binaries")){
		it(`should be able to read the binary file ${filename}`, () => {
			const filepath = path.join(os.tmpdir(), `msch-generate-test-build-${filename}.json`);
			runMsch("manipulate", path.join(cwd, "sample-binaries", filename), "-o", filepath);
		});
	}
});
