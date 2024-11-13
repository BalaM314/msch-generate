import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { mschGenerate } from "../../build/app.js";
import "../../build/global-types.js";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
process.chdir(path.join(rootDir, "spec"));
function runMsch(...args:string[]){
	spyOn(console, "log");
	return mschGenerate.run(["node", path.join(rootDir, "build/cli.js"), ...args], {throwOnError: true});
}



describe("msch build", () => {
	for(const filename of fs.readdirSync("sample-input").filter(f => f.endsWith(".json"))){
		it(`should parse file ${filename} and produce a binary`, async () => {
			const filepath = path.join(os.tmpdir(), `msch-generate-test-build-${filename}`);
			try {
				fs.rmSync(filepath);
			} catch {}
			await runMsch("build", path.join(process.cwd(), "sample-input", filename), "--output", filepath);
			fs.accessSync(filepath, fs.constants.R_OK);
		});
	}
});

describe("msch init", () => {
	it(`should create a new schematic file that is valid JSON`, async () => {
		const filepath = path.join(os.tmpdir(), "msch-generate-test-init.json");
		await runMsch(
			"init",
			"--name",
			"NAME",
			filepath
		);
		const data = fs.readFileSync(filepath, "utf-8");
		expect(() => void JSON.parse(data)).not.toThrow();
	});
});

describe("msch manipulate", () => {
	for(const filename of fs.readdirSync("sample-binaries").filter(f => f.endsWith(".msch"))){
		it(`should be able to read the binary file ${filename}`, async () => {
			await runMsch("manipulate", "--read", path.join(process.cwd(), "sample-binaries", filename));
		});
	}
});
