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

	// 1) Remove existing folder if present
	if (fs.existsSync(workspaceDir)) {
		const { confirm } = await inquirer.prompt([
			{ type: 'confirm', name: 'confirm', message: `Directory "${name}" exists. Delete?`, default: false },
		]);
		if (!confirm) {
			console.log('Aborting.');
			process.exit(1);
		}
		console.log('Removing existing workspace…');
		fs.rmSync(workspaceDir, { recursive: true, force: true });
	}

	// 2) Bootstrap Nx workspace
	console.log(`Bootstrapping "${name}" with preset="${preset}", pm="${pm}"…`);
	await execa(
		'npx',
		['create-nx-workspace@latest', name, `--preset=${preset}`, `--packageManager=${pm}`, '--interactive=false'],
		{ stdio: 'inherit' }
	);

	process.chdir(workspaceDir);

	// 3) Install essential plugins
	console.log('Installing Nx plugins…');
	await execa('npm', ['install', '--save-dev', '@nx/react', '@nx/storybook', '@nrwl/express'], { stdio: 'inherit' });

	// 4) Generate UI library (buildable & publishable)
	console.log('Generating "ui-components" library…');
	await execa(
		'npx',
		[
			'nx',
			'g',
			'@nx/react:library',
			'ui-components',
			'--style=css',
			'--buildable',
			'--publishable',
			'--importPath=@massxr/ui-components',
			'--no-interactive',
		],
		{ stdio: 'inherit' }
	);

	// 5) Configure Storybook for ui-components
	console.log('Configuring Storybook…');
	await execa(
		'npx',
		['nx', 'g', '@nx/react:storybook-configuration', 'ui-components', '--generateStories=true', '--no-interactive'],
		{ stdio: 'inherit' }
	);

	// 6) Scaffold Express business-api skeleton
	console.log('Generating Express "business-api"…');
	await execa(
		'npx',
		['nx', 'g', '@nrwl/express:application', 'business-api', '--directory=api', '--no-interactive'],
		{ stdio: 'inherit' }
	);

	// 7) Write placeholder main.ts
	const apiPath = path.join(workspaceDir, 'apps', 'api', 'business-api', 'src', 'main.ts');
	const mainTs = `import express from 'express';
// TODO: integrate dynamic AI/canonical content per client
const app = express(); const port = process.env.PORT ?? 3333;
app.use(express.json());
app.listen(port, () => console.log('Business API listening on http://localhost:' + port));
`;
	fs.writeFileSync(apiPath, mainTs);

	// 8) Write Dockerfile
	const dfPath = path.join(workspaceDir, 'apps', 'api', 'business-api', 'Dockerfile');
	const df = `FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
EXPOSE 3333
CMD ["node","dist/main.js"]
`;
	fs.writeFileSync(dfPath, df);

	// 9) Write docker-compose.yaml
	const dc = `version: '3.8'
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
	fs.writeFileSync(path.join(workspaceDir, 'docker-compose.yaml'), dc);

	console.log('✅ Workspace "' + name + '" scaffolded with UI lib, Storybook, API, Docker.');
}
