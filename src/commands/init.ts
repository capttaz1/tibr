#!/usr/bin/env node
import { execa } from 'execa';
import * as fs from 'fs';
import inquirer from 'inquirer';
import * as path from 'path';
import { Argv } from 'yargs';

export const command = 'init <name>';
export const desc = 'Bootstrap a new Nx workspace + standard apps/libs';
export const builder = (yargs: Argv) =>
  yargs
    .positional('name', {
      describe: 'Name of the new workspace',
      type: 'string',
      demandOption: true,
    })
    .option('preset', {
      alias: 'p',
      describe: 'Preset to use (e.g., apps, react-monorepo, ts)',
      type: 'string',
      choices: ['apps', 'react-monorepo', 'ts'] as const,
      default: 'apps',
    })
    .option('pm', {
      alias: 'm',
      describe: 'Package manager to use',
      type: 'string',
      choices: ['npm', 'yarn', 'pnpm'] as const,
      default: 'npm',
    });

export interface InitOptions {
  name: string;
  preset: 'apps' | 'react-monorepo' | 'ts';
  pm: 'npm' | 'yarn' | 'pnpm';
}

export async function handler(args: InitOptions) {
  const { name, preset, pm } = args;
  const workspaceDir = path.resolve(process.cwd(), name);

  // 1) if the folder exists, prompt & remove it
  if (fs.existsSync(workspaceDir)) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Directory "${name}" already exists. Delete it?`,
        default: false,
      },
    ]);
    if (!confirm) {
      console.log('Aborting.');
      process.exit(1);
    }
    console.log('Removing existing workspace…');
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  }

  // 2) bootstrap the Nx workspace
  console.log(`Bootstrapping "${name}" with preset="${preset}", packageManager="${pm}"…`);
  await execa(
    'npx',
    ['create-nx-workspace@latest', name, `--preset=${preset}`, `--packageManager=${pm}`, '--interactive=false'],
    { stdio: 'inherit' }
  );

  // 3) cd into new workspace
  process.chdir(workspaceDir);

  // 4) install necessary plugins and dependencies
  console.log('Installing Nx plugins and Storybook dependencies…');
  await execa(
    'npm',
    [
      'install',
      '--save-dev',
      '@nx/react',
      '@nx/storybook',
      '@nrwl/express',
      '@storybook/react',
      '@storybook/addon-essentials',
    ],
    { stdio: 'inherit' }
  );

  // 5) generate a buildable, publishable React library with Storybook
  console.log('Generating "ui-components" React library…');
  await execa(
    'npx',
    [
      'nx',
      'g',
      '@nx/react:library',
      'ui-components',
      '--directory=libs',
      '--style=css',
      '--buildable',
      '--publishable',
      '--importPath=@massxr/ui-components',
      '--no-interactive',
    ],
    { stdio: 'inherit' }
  );
  console.log('Configuring Storybook for "ui-components"…');
  await execa(
    'npx',
    [
      'nx',
      'g',
      '@nx/react:storybook-configuration',
      'libs-ui-components',
      '--generateStories=true',
      '--no-interactive',
    ],
    { stdio: 'inherit' }
  );

  // 6) generate the Express "business-api" application
  console.log('Generating Express "business-api" application…');
  await execa(
    'npx',
    [
      'nx',
      'g',
      '@nrwl/express:application',
      'business-api',
      '--directory=api',
      '--no-interactive',
    ],
    { stdio: 'inherit' }
  );

  // 7) overwrite main.ts with our proxy logic
  const mainTsPath = path.join(
    workspaceDir,
    'apps',
    'api',
    'business-api',
    'src',
    'main.ts'
  );
  const mainTsContent = `import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT ?? 3333;
const postgrestUrl = process.env.POSTGREST_URL ?? 'http://localhost:3000';

app.get('/training-rooms', async (_req, res) => {
  try {
    const { data } = await axios.get(`${postgrestUrl}/training_rooms`);
    res.json(data);
  } catch (err) {
    console.error('Error fetching from PostgREST:', err);
    res.status(500).json({ error: 'Failed to fetch training rooms' });
  }
});

app.listen(port, () => {
  console.log(`Business API listening on http://localhost:${port}`);
});
`;
  fs.writeFileSync(mainTsPath, mainTsContent);

  // 8) write Dockerfile
  const dockerfilePath = path.join(
    workspaceDir,
    'apps',
    'api',
    'business-api',
    'Dockerfile'
  );
  const dockerfileContent = `FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build

EXPOSE 3333
CMD ["node", "dist/main.js"]
`;
  fs.writeFileSync(dockerfilePath, dockerfileContent);

  // 9) write docker-compose.yaml at the workspace root
  const dcPath = path.join(workspaceDir, 'docker-compose.yaml');
  const dcContent = `version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: tibr
      POSTGRES_PASSWORD: changeme
      POSTGRES_DB: tibr
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - '5432:5432'

  postgrest:
    image: postgrest/postgrest
    environment:
      PGRST_DB_URI: postgres://tibr:changeme@postgres:5432/tibr
      PGRST_DB_SCHEMA: public
      PGRST_DB_ANON_ROLE: anon
    ports:
      - '3000:3000'
    depends_on:
      - postgres

  business-api:
    build:
      context: .
      dockerfile: apps/api/business-api/Dockerfile
    environment:
      PORT: 3333
      POSTGREST_URL: http://postgrest:3000
    ports:
      - '3333:3333'
    depends_on:
      - postgrest

volumes:
  postgres-data:
`;
  fs.writeFileSync(dcPath, dcContent);

  console.log('✅ Done! Your workspace (massxr) is fully scaffolded.');
}
