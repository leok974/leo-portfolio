#!/usr/bin/env node
// Validate payload files against JSON schemas
import Ajv from "ajv";
import addFormats from "ajv-formats";
import fs from "node:fs";
import path from "node:path";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const payloadsDir = "scripts/payloads";

// Payload files to validate
const payloads = [
  { schema: "schema.seo-validate.json", data: "seo-validate.json" },
  { schema: "schema.seo-tune.json", data: "seo-tune.json" },
];

let hasErrors = false;

console.log("🔍 Validating payload files...\n");

for (const { schema: schemaFile, data: dataFile } of payloads) {
  const schemaPath = path.join(payloadsDir, schemaFile);
  const dataPath = path.join(payloadsDir, dataFile);

  try {
    // Check if files exist
    if (!fs.existsSync(schemaPath)) {
      console.error(`❌ Schema not found: ${schemaPath}`);
      hasErrors = true;
      continue;
    }
    if (!fs.existsSync(dataPath)) {
      console.error(`❌ Payload not found: ${dataPath}`);
      hasErrors = true;
      continue;
    }

    // Load and validate
    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    
    const validate = ajv.compile(schema);
    const valid = validate(data);

    if (!valid) {
      console.error(`❌ ${dataFile} - INVALID`);
      console.error(`   Schema: ${schemaFile}`);
      console.error(`   Errors: ${ajv.errorsText(validate.errors)}`);
      console.error();
      hasErrors = true;
    } else {
      console.log(`✅ ${dataFile} - Valid`);
    }
  } catch (err) {
    console.error(`❌ ${dataFile} - ERROR: ${err.message}`);
    hasErrors = true;
  }
}

console.log();

if (hasErrors) {
  console.error("❌ Payload validation failed");
  process.exit(1);
} else {
  console.log("✅ All payloads valid");
  process.exit(0);
}
