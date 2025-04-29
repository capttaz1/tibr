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

	// Cleanup any stray root-level ui-components or libs/ui-components folders from previous runs
	const strayRootUI = path.join(workspaceDir, 'ui-components');
	if (fs.existsSync(strayRootUI)) {
		fs.rmSync(strayRootUI, { recursive: true, force: true });
	}
	const strayLibsUI = path.join(workspaceDir, 'libs', 'ui-components');
	if (fs.existsSync(strayLibsUI)) {
		fs.rmSync(strayLibsUI, { recursive: true, force: true });
	}

	// Clean up any root-level ui-components leftover from prior runs
	const rootLib = path.join(workspaceDir, 'ui-components');
	if (fs.existsSync(rootLib)) {
		fs.rmSync(rootLib, { recursive: true, force: true });
	}

	// 3) Install Nx plugins
	console.log('Installing Nx plugins…');
	const nxInstallArgs =
		pm === 'npm'
			? ['install', '--save-dev', '@nx/react', '@nx/storybook', '@nx/express']
			: ['add', '-D', '@nx/react', '@nx/storybook', '@nx/express'];
	await execa(pm, nxInstallArgs, { stdio: 'inherit' });

	// 4) Generate UI component library (in libs/ui-components)
	console.log('Generating ui-components library under libs/...');
	await execa(
		'npx',
		[
			'nx',
			'g',
			'@nx/react:library',
			'ui-components',
			// by default, libraries go under libs/<name>
			'--style=css',
			'--publishable',
			'--bundler=rollup',
			'--importPath=@massxr/ui-components',
			'--no-interactive',
		],
		{ stdio: 'inherit' }
	);
	await execa(
		'npx',
		[
			'nx',
			'g',
			'@nx/react:library',
			'ui-components',
			'--directory=libs',
			'--style=css',
			'--publishable',
			'--bundler=rollup',
			'--importPath=@massxr/ui-components',
			'--no-interactive',
		],
		{ stdio: 'inherit' }
	);

	// 5) Add and configure Storybook via Nx plugin
	console.log('Adding and configuring @nx/storybook plugin...');
	await execa('npx', ['nx', 'add', '@nx/storybook'], { stdio: 'inherit' });

	// Write manual .storybook configuration
	const sbRoot = path.join(workspaceDir, 'libs', 'ui-components');
	const sbConfigDir = path.join(sbRoot, '.storybook');
	fs.mkdirSync(sbConfigDir, { recursive: true });
	const mainTs = `import type { StorybookConfig } from '@storybook/react-webpack5';
const config: StorybookConfig = {
  stories: ['../src/lib/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: '@storybook/react-webpack5',
};
export default config;
`;
	fs.writeFileSync(path.join(sbConfigDir, 'main.ts'), mainTs);

	// Patch ui-components project.json to add Storybook targets
	const projJsonPath = path.join(sbRoot, 'project.json');
	if (fs.existsSync(projJsonPath)) {
		const proj = JSON.parse(fs.readFileSync(projJsonPath, 'utf-8'));
		proj.targets = proj.targets || {};
		if (!proj.targets.storybook) {
			proj.targets.storybook = {
				executor: '@nx/storybook:storybook',
				options: {
					uiFramework: '@storybook/react-webpack5',
					config: { configFolder: '.storybook' },
					outputDir: 'dist/storybook/ui-components',
				},
			};
			proj.targets['build-storybook'] = {
				executor: '@nx/storybook:build',
				options: {
					uiFramework: '@storybook/react-webpack5',
					config: { configFolder: '.storybook' },
					outputDir: 'dist/storybook/ui-components',
				},
			};
			fs.writeFileSync(projJsonPath, JSON.stringify(proj, null, 2));
		}
	}

	// 6) Generate Express business-api (no e2e) (no e2e)
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

	// 7) Write placeholder main.ts for API
	const apiRoot = path.join(workspaceDir, apiDir);
	const apiMain = path.join(apiRoot, 'src', 'main.ts');
	fs.mkdirSync(path.dirname(apiMain), { recursive: true });
	fs.writeFileSync(
		apiMain,
		`import express from 'express';
const app = express();
const port = process.env.PORT ?? 3333;
app.use(express.json());
app.listen(port, () => console.log('Business API listening on http://localhost:' + port));
`
	);

	// 8) Fix tsconfig.app.json
	const tsPath = path.join(apiRoot, 'tsconfig.app.json');
	if (fs.existsSync(tsPath)) {
		const cfg = JSON.parse(fs.readFileSync(tsPath, 'utf-8'));
		cfg.compilerOptions = cfg.compilerOptions || {};
		cfg.compilerOptions.moduleResolution = 'NodeNext';
		cfg.compilerOptions.module = 'NodeNext';
		delete cfg.compilerOptions.bundler;
		fs.writeFileSync(tsPath, JSON.stringify(cfg, null, 2));
	}

	// 9) Write Dockerfile for API
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

	// 10) Emit docker-compose.yaml
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
