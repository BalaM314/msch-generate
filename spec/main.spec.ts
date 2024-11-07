import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { mschGenerate } from "../build/index.js";

const cwd = path.dirname(fileURLToPath(import.meta.url));
process.chdir(cwd);

