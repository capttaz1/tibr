#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Argv } from 'yargs';
import { loadConfig } from '../config';

export const command = 'generate service <entity>';
export const desc = 'Scaffold a business‐logic service and controller + router for an entity';

export interface GenerateServiceOptions {
	entity: string;
}

export const builder = (yargs: Argv) =>
	yargs.positional('entity', {
		describe: 'Entity name (e.g. User)',
		type: 'string',
		demandOption: true,
	});

export async function handler({ entity }: GenerateServiceOptions) {
	const cfg = loadConfig();
	const name = entity.toLowerCase();
	const className = entity.charAt(0).toUpperCase() + entity.slice(1);

	// Create directories
	const baseDir = path.join(process.cwd(), 'apps', 'api', 'src', 'app', name);
	fs.mkdirSync(baseDir, { recursive: true });

	// Service file
	const svcPath = path.join(baseDir, `${name}.service.ts`);
	const svcContent = `import fetch from 'node-fetch';

/**
 * Business logic for ${className}
 */
export class ${className}Service {
  private baseUrl = process.env.POSTGREST_URL || 'http://localhost:3000/${name}s';

  async findAll() {
    const res = await fetch(this.baseUrl);
    return res.json();
  }

  async findOne(id: string) {
    const res = await fetch(\`\${this.baseUrl}?id=eq.\${id}\`);
    const data = await res.json();
    return data[0];
  }

  async create(payload: any) {
    // TODO: validate payload
    await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async update(id: string, payload: any) {
    // TODO: business rules
    await fetch(\`\${this.baseUrl}?id=eq.\${id}\`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async remove(id: string) {
    await fetch(\`\${this.baseUrl}?id=eq.\${id}\`, {
      method: 'DELETE',
    });
  }
}
`;
	fs.writeFileSync(svcPath, svcContent);
	console.log(`✅ Wrote service to ${svcPath}`);

	// Controller + router file
	const ctrlPath = path.join(baseDir, `${name}.controller.ts`);
	const ctrlContent = `import { Router } from 'express';
import { ${className}Service } from './${name}.service';

const router = Router();
const svc = new ${className}Service();

router.get('/', async (req, res) => {
  const items = await svc.findAll();
  res.json(items);
});

router.get('/:id', async (req, res) => {
  const item = await svc.findOne(req.params.id);
  res.json(item);
});

router.post('/', async (req, res) => {
  await svc.create(req.body);
  res.sendStatus(201);
});

router.patch('/:id', async (req, res) => {
  await svc.update(req.params.id, req.body);
  res.sendStatus(204);
});

router.delete('/:id', async (req, res) => {
  await svc.remove(req.params.id);
  res.sendStatus(204);
});

export default router;
`;
	fs.writeFileSync(ctrlPath, ctrlContent);
	console.log(`✅ Wrote controller to ${ctrlPath}`);

	console.log(`🎉 Service & routes for "${className}" are ready.`);
}
