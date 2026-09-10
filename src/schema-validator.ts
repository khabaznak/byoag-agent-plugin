import { readFile } from "node:fs/promises";
import path from "node:path";

import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";

import { ByoagError } from "./errors.js";

const SCHEMA_FILES = [
  "permission.schema.json",
  "delegation.schema.json",
  "capability.schema.json",
  "skill-bundle.schema.json",
  "engagement.schema.json",
  "discovery.schema.json",
  "pairing.schema.json",
  "jwks.schema.json",
] as const;

export class SchemaValidator {
  private readonly validators = new Map<string, ValidateFunction>();

  static async load(schemaDirectory: string): Promise<SchemaValidator> {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    const addFormats = addFormatsModule as unknown as (instance: Ajv2020) => Ajv2020;
    addFormats(ajv);
    const documents = await Promise.all(SCHEMA_FILES.map(async (file) => ({
      file,
      schema: JSON.parse(await readFile(path.join(schemaDirectory, file), "utf8")) as object,
    })));
    for (const { schema } of documents) ajv.addSchema(schema);

    const instance = new SchemaValidator();
    for (const { file, schema } of documents) {
      const id = (schema as { $id?: string }).$id;
      const validator = id ? ajv.getSchema(id) : undefined;
      if (!validator) throw new ByoagError("storage_error", `Could not compile ${file}.`);
      instance.validators.set(file, validator);
    }
    return instance;
  }

  assertValid(name: typeof SCHEMA_FILES[number], value: unknown, code: "discovery_invalid" | "engagement_invalid" | "platform_error"): void {
    const validator = this.validators.get(name);
    if (!validator || !validator(value)) {
      throw new ByoagError(code, `The platform returned an invalid ${name.replace(".schema.json", "")} document.`);
    }
  }
}
