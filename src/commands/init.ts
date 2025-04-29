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
			describe: 'Preset to use (apps, react-monorepo, ts)',
			type: 'string',
			choices: ['apps', 'react-monorepo', 'ts'] as const,
			default: 'apps',
		})
		.option('pm', {
			alias: 'm',
			describe: 'Package manager to use (npm, yarn, pnpm)',
			type: 'string',
			choices: ['npm', 'yarn', 'pnpm'] as const,
			default: 'npm',
		});

export interface InitOptions {
	name: string;
	preset: 'apps' | 'react-monorepo' | 'ts';
	pm: 'npm' | 'yarn' | 'pnpm';
}

export async function handler({ name, preset, pm }: InitOptions) {
	const workspaceDir = path.resolve(process.cwd(), name);

	// 1) Remove existing directory
	if (fs.existsSync(workspaceDir)) {
		const { confirm } = await inquirer.prompt([
			{
				type: 'confirm',
				name: 'confirm',
				message: `Directory "${name}" exists. Delete?`,
				default: false,
			},
		]);
		if (!confirm) {
			console.log('Aborting.');
			process.exit(1);
		}
		fs.rmSync(workspaceDir, { recursive: true, force: true });
	}

	// 2) Bootstrap Nx workspace
	console.log(`Bootstrapping workspace "${name}" (preset=${preset}, pm=${pm})…`);
	await execa(
		'npx',
		['create-nx-workspace@latest', name, `--preset=${preset}`, `--packageManager=${pm}`, '--interactive=false'],
		{ stdio: 'inherit' }
	);
	process.chdir(workspaceDir);

	// 3) Install Nx plugins
	console.log('Installing Nx plugins…');
	await execa('npm', ['install', '--save-dev', '@nx/react', '@nx/storybook', '@nx/express'], { stdio: 'inherit' });

	// 4) Generate UI library
	console.log('Generating ui-components library…');
	await execa(
		'npx',
		[
			'nx',
			'g',
			'@nx/react:library',
			'ui-components',
			'--style=css',
			'--publishable',
			'--bundler=rollup',
			'--importPath=@massxr/ui-components',
			'--no-interactive',
		],
		{ stdio: 'inherit' }
	);

	// 5) Manual Storybook config
	console.log('Configuring Storybook for ui-components…');
	const sbDir = path.join(workspaceDir, 'ui-components', '.storybook');
	fs.mkdirSync(sbDir, { recursive: true });
	fs.writeFileSync(
		path.join(sbDir, 'main.js'),
		`module.exports = {
  stories: ['../src/lib/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: '@storybook/react',
};`
	);
	fs.writeFileSync(
		path.join(sbDir, 'preview.js'),
		`export const parameters = {
  actions: { argTypesRegex: '^on[A-Z].*' },
  controls: { expanded: true },
};`
	);
	// Patch project.json
	const projJson = path.join(workspaceDir, 'ui-components', 'project.json');
	if (fs.existsSync(projJson)) {
		const cfg = JSON.parse(fs.readFileSync(projJson, 'utf-8'));
		cfg.targets = cfg.targets || {};
		if (!cfg.targets.storybook) {
			cfg.targets.storybook = {
				executor: '@nx/storybook:storybook',
				options: {
					uiFramework: '@storybook/react',
					config: { configFolder: 'ui-components/.storybook' },
					outputDir: 'dist/storybook/ui-components',
				},
			};
			cfg.targets['build-storybook'] = {
				executor: '@nx/storybook:build',
				options: {
					uiFramework: '@storybook/react',
					config: { configFolder: 'ui-components/.storybook' },
					outputDir: 'dist/storybook/ui-components',
				},
			};
			fs.writeFileSync(projJson, JSON.stringify(cfg, null, 2));
		}
	}

	// 6) Generate Express API
	console.log('Generating business-api application…');
	const apiDir = 'apps/api/business-api';
	await execa(
		'npx',
		[
			'nx',
			'g',
			'@nx/express:application',
			'business-api',
			`--directory=${apiDir}`,
			'--e2eTestRunner=none',
			'--no-interactive',
		],
		{ stdio: 'inherit' }
	);

	// 7) Write placeholder main.ts
	const apiRoot = path.join(workspaceDir, apiDir);
	const mainTs = path.join(apiRoot, 'src', 'main.ts');
	fs.mkdirSync(path.dirname(mainTs), { recursive: true });
	fs.writeFileSync(
		mainTs,
		`import express from 'express';
const app = express();
const port = process.env.PORT ?? 3333;
app.use(express.json());
app.listen(port, () => console.log(
  'Business API listening on http://localhost:' + port
));
`
	);

	// 8) Fix tsconfig
	const tsPath = path.join(apiRoot, 'tsconfig.app.json');
	if (fs.existsSync(tsPath)) {
		const c = JSON.parse(fs.readFileSync(tsPath, 'utf-8'));
		c.compilerOptions = c.compilerOptions || {};
		c.compilerOptions.moduleResolution = 'NodeNext';
		c.compilerOptions.module = 'NodeNext';
		delete c.compilerOptions.bundler;
		fs.writeFileSync(tsPath, JSON.stringify(c, null, 2));
	}

	// 9) Write Dockerfile
	fs.writeFileSync(
		path.join(apiRoot, 'Dockerfile'),
		`FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
EXPOSE 3333
CMD ["node","dist/main.js"]
`
	);

	// 10) docker-compose
	fs.writeFileSync(
		path.join(workspaceDir, 'docker-compose.yaml'),
		`version: '3.8'
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
`
	);

	console.log(`✅ Workspace "${name}" scaffolded!`);
}
