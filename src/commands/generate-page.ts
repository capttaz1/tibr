#!/usr/bin/env node
// src/commands/generate-page.ts

import fs from 'fs';
import path from 'path';
import { Argv } from 'yargs';
import { loadConfig } from '../config';

export const command = 'generate page <type> <entity>';
export const desc = 'Generate list or detail React pages for an entity';

export const builder = (yargs: Argv) =>
	yargs
		.positional('type', {
			describe: 'Page type (list or detail)',
			choices: ['list', 'detail'] as const,
		})
		.positional('entity', {
			describe: 'Entity name (e.g. User)',
			type: 'string',
			demandOption: true,
		});

export type PageType = 'list' | 'detail';

export interface GeneratePageOptions {
	type: PageType;
	entity: string;
}

export async function handler({ type, entity }: GeneratePageOptions) {
	const cfg = loadConfig();
	const uiDir = path.join(process.cwd(), 'libs', cfg.uiProject || 'shared-ui', 'src', 'lib');
	fs.mkdirSync(uiDir, { recursive: true });
	const PageName = entity.charAt(0).toUpperCase() + entity.slice(1) + (type === 'list' ? 'List' : 'Detail');
	const filePath = path.join(uiDir, `${PageName}.tsx`);

	let content = '';
	if (type === 'list') {
		content = `import React, { useEffect, useState } from 'react';
import { ${entity}FormValues } from './${entity.charAt(0).toUpperCase() + entity.slice(1)}Form';

export const ${PageName}: React.FC = () => {
  const [items, setItems] = useState<${entity}FormValues[]>([]);

  useEffect(() => {
    fetch('/api/${entity.toLowerCase()}s')
      .then(res => res.json())
      .then(data => setItems(data));
  }, []);

  return (
    <div>
      <h1>${entity} List</h1>
      <ul>
        {items.map(item => (
          <li key={(item as any).id}>{JSON.stringify(item)}</li>
        ))}
      </ul>
    </div>
  );
};
`;
	} else {
		content = `import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ${entity}FormValues } from './${entity.charAt(0).toUpperCase() + entity.slice(1)}Form';

export const ${PageName}: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<${entity}FormValues | null>(null);

  useEffect(() => {
    fetch('/api/${entity.toLowerCase()}s/' + id)
      .then(res => res.json())
      .then(data => setItem(data));
  }, [id]);

  if (!item) return <div>Loading...</div>;

  return (
    <div>
      <h1>${entity} Detail</h1>
      <pre>{JSON.stringify(item, null, 2)}</pre>
    </div>
  );
};
`;
	}

	fs.writeFileSync(filePath, content);
	console.log(`✅ Generated ${type} page at ${filePath}`);
}
