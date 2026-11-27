// JSON Schema checks for the files the dev server writes. Node only.

import { readFileSync } from "node:fs";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { vocabPath } from "./paths";

function compile(schemaFile: string): ValidateFunction {
  // strictRequired is off because the schemas use `required` inside anyOf/if branches.
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(readFileSync(vocabPath(schemaFile), "utf8")));
}

let annotationValidator: ValidateFunction | undefined;
let registryValidator: ValidateFunction | undefined;

function errorsOf(validate: ValidateFunction, document: unknown): string[] {
  if (validate(document)) return [];
  return (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? "is invalid"}`);
}

/** Schema errors for an Annotation document; empty when it is valid. */
export function schemaErrors(document: unknown): string[] {
  annotationValidator ??= compile("annotation.schema.json");
  return errorsOf(annotationValidator, document);
}

/** Schema errors for an Athlete registry document; empty when it is valid. */
export function registrySchemaErrors(document: unknown): string[] {
  registryValidator ??= compile("athletes.schema.json");
  return errorsOf(registryValidator, document);
}
