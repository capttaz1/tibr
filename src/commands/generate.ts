#!/usr/bin/env node

import { execa } from 'execa';
import { Argv } from 'yargs';

export const command = 'generate <type> <name>';
export const desc = 'Generate a new component or Express route stub';

export const builder = (yargs: Argv) =>
  yargs
    .positional('type', {
      describe: 'What to generate',
      choices: ['component', 'route'] as const,
    })
    .positional('name', {
      describe: 'Name of the component or route',
      type: 'string',
      demandOption: true,
    });

export interface GenerateOptions {
  type: 'component' | 'route';
  name: string;
}

// TODO: Check on this
export async function handler({ type, name }: GenerateOptions) {
  if (type === 'component') {
    console.log(`🔧 Generating React component "${name}"...`);
    await execa(
      'npx',
      [
        'nx',
        'g',
        '@nx/react:component',
        `--name=${name}`,
        '--project=ui',      // adjust if your project is named differently
        '--export',
        '--style=css',
      ],
      { stdio: 'inherit' }
    );
  } else {
    console.log(`🔧 Generating Express route stub "${name}"...`);
    // you can swap to an Nx plugin if you have one; here's a simple file-based stub:
    const fs = require('fs');
    const path = require('path');
    const route = name.toLowerCase();
    const targetDir = path.join(process.cwd(), 'apps', 'api', 'src', 'app');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const filePath = path.join(targetDir, `${route}.ts`);
    const content = `import { Router } from 'express';
const router = Router();

router.get('/${route}', (req, res) => {
  res.json({ message: '${name} endpoint' });
});

export default router;
`;
    fs.writeFileSync(filePath, content);
    console.log(`→ Created ${filePath}`);
  }

  console.log('✅ Done.');
}