#!/usr/bin/env node
// src/commands/generate-form.ts

import fs from 'fs';
import path from 'path';
import { Argv } from 'yargs';
import { loadConfig } from '../config';

export const command = 'generate form <entity>';
export const desc = 'Scaffold a React-Hook-Form component based on the JSON schema of an entity';

export interface GenerateFormOptions {
	entity: string;
}

export const builder = (yargs: Argv) =>
	yargs.positional('entity', {
		describe: 'Entity name (e.g. User)',
		type: 'string',
		demandOption: true,
	});

export async function handler({ entity }: GenerateFormOptions) {
	const cfg = loadConfig();
	const schemaPath = path.join(process.cwd(), 'libs', 'domain', 'src', 'lib', `${entity.toLowerCase()}.schema.json`);

	if (!fs.existsSync(schemaPath)) {
		console.error(`❌ Schema not found at ${schemaPath}`);
		process.exit(1);
	}

	const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
	const compName = `${entity.charAt(0).toUpperCase() + entity.slice(1)}Form`;
	const outputDir = path.join(process.cwd(), 'libs', cfg.uiProject || 'shared-ui', 'src', 'lib');
	fs.mkdirSync(outputDir, { recursive: true });
	const filePath = path.join(outputDir, `${compName}.tsx`);

	// Build form fields
	const fields = Object.entries(schema.properties)
		.map(([name, prop]: [string, any]) => {
			const label = name.replace(/([A-Z])/g, ' $1').replace(/^./, (s: string) => s.toUpperCase());
			return `      <div className="form-field">
        <label htmlFor="${name}">${label}</label>
        <input id="${name}" {...register('${name}', { required: true })} />
        {errors.${name} && <span>${label} is required</span>}
      </div>`;
		})
		.join('\n');

	// Form component template
	const content = `import React from 'react';
import { useForm } from 'react-hook-form';

export interface ${entity}FormValues {
${Object.keys(schema.properties)
	.map((name) => `  ${name}: ${schema.properties[name].type};`)
	.join('\n')}
}

export const ${compName}: React.FC<{
  onSubmit: (data: ${entity}FormValues) => void;
}> = ({ onSubmit }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<${entity}FormValues>();

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
${fields}
      <button type="submit">Save</button>
    </form>
  );
};
`;

	fs.writeFileSync(filePath, content);
	console.log(`✅ Generated form component at ${filePath}`);
}
