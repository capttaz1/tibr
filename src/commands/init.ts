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
		[
			'create-nx-workspace@latest',
			`--appName=client`,
			`--name=${name}`,
			'--bundler=webpack',
			`--preset=${preset}`,
			`--packageManager=${pm}`,
			'--ci=skip',
			'--unitTestRunner=jest',
			'--e2eTestRunner=playwright',
			'--style=css',
			'--formatter=prettier',
			'--interactive=true',
		],
		{ stdio: 'inherit' }
	);
	process.chdir(workspaceDir);

	// 3) Install Nx plugins this should happen through Nx not NPM? or also with npm?
	console.log('Installing Nx plugins…');

	// install express
	await execa('npx', ['nx', 'add', '@nx/express'], { stdio: 'inherit' });
	// install react
	await execa('npx', ['nx', 'add', '@nx/react'], { stdio: 'inherit' });
	// // install cypress - not sure why ...
	// await execa('npx', ['nx', 'add', '@nx/cypress'], { stdio: 'inherit' });
	// // install storybook
	// await execa('npx', ['nx', 'add', '@nx/storybook'], { stdio: 'inherit' });
	// // install playwright
	// await execa('npx', ['nx', 'add', '@nx/playwright'], { stdio: 'inherit' });

	// 4) Generate UI component library (in libs/ui)
	console.log('Generating ui components library...');
	// correct command
	// npx nx g @nx/react:library libs/shared/ui --unitTestRunner=jest --bundler=none
	await execa(
		'npx',
		[
			'nx',
			'g',
			'@nx/react:library',
			'--name=ui',
			'--directory=libs/shared/ui',
			'--bundler=none',
			'--linter=eslint',
			'--unitTestRunner=jest',
			'--e2eTestRunner=none',
			'--interactive=true',
		],
		{
			stdio: 'inherit',
		}
	);

	// 5) Add and configure Storybook via Nx plugin
	console.log('Adding and configuring @nx/storybook plugin...');
	// correct command: nx g @nx/react:storybook-configuration ui
	await execa(
		'npx',
		[
			'nx',
			'g',
			'@nx/react:storybook-configuration',
			'ui',
			'--generateStories=true',
			'--configureStaticServe=true',
			'--interactionTests=true',
		],
		{
			stdio: 'inherit',
		}
	);

	// 6) Generate Express business api (no e2e)
	// npx nx g @nx/react:library libs/api --unitTestRunner=jest --bundler=none
	// npx nx g @nx/express:app apps/my-express-api
	console.log('Generating business api application…');
	await execa(
		'npx',
		[
			'nx',
			'g',
			'@nx/express:app',
			'--name=api',
			'--directory=libs/api',
			'--bundler=none',
			'--linter=eslint',
			'--unitTestRunner=jest',
			'--e2eTestRunner=none',
			'--interactive=true',
		],
		{
			stdio: 'inherit',
		}
	);

	// 7) Create a js library to hold the backend docker compose
	console.log('Generating docker compose library...');
	// command: npx nx g @nx/js:lib libs/mylib --bundler=none

	await execa(
		'npx',
		[
			'nx',
			'g',
			'@nx/js:library',
			'--name=data',
			'--bundler=none',
			'--directory=libs/data',
			'--linter=eslint',
			'--unitTestRunner=jest',
			'--e2eTestRunner=none',
			'--interactive=true',
		],
		{
			stdio: 'inherit',
		}
	);

	// 9) Write the docker-compose for the backend
	const dataRoot = path.join(workspaceDir, 'libs', 'data');
	fs.writeFileSync(
		path.join(dataRoot, 'docker-compose.yml'),
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
	      PGRST_DB_URI: postgres://tibr:password@postgres:5432/tib
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
	      POSTGREST_URL: http://localhost:3000
	    ports:
	      - '3333:3333'
	    depends_on:
	      - postgrest
	volumes:
	  - postgres-data:
	`
	);

	console.log(`✅ Workspace "${name}" scaffolded!`);
}
