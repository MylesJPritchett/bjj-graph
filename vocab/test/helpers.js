import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const vocabDir = fileURLToPath(new URL("..", import.meta.url));

export function readJson(relativePath) {
  return JSON.parse(readFileSync(vocabDir + relativePath, "utf8"));
}

export function validator(schemaPath) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(readJson(schemaPath));
}

export function errorsOf(validate) {
  return JSON.stringify(validate.errors, null, 2);
}
