// src/commands/init.ts

import { execa } from 'execa';
import * as fs from 'fs';
import { existsSync, readFileSync } from 'fs';
import inquirer from 'inquirer';
import * as path from 'path';
import { join } from 'path';

export async function initHandler(name: string, preset: 'react-monorepo' | 'ts', pm: 'npm' | 'yarn' | 'pnpm') {
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
		console.log('🗑 Removing existing workspace…');
		fs.rmSync(workspaceDir, { recursive: true, force: true });
	}

	// 2) bootstrap the Nx workspace (no prompts, no Nx Cloud)
	console.log(`🚀 Bootstrapping "${name}" with preset="${preset}", packageManager="${pm}"…`);
	await execa(
		'npx',
		[
			'create-nx-workspace@latest',
			name,
			`--preset=${preset}`,
			`--packageManager=${pm}`,
			'--interactive=false',
			'--ci=skip', // ← changed here from --nxCloud=false
		],
		{ stdio: 'inherit' }
	);

	process.chdir(workspaceDir);

	// 3) install & initialize Nx plugins
	console.log('🔧 Installing & initializing Nx plugins…');
	await execa(pm, ['install', '-D', '@nx/express', '@nx/react', '@nx/storybook', '@nx/cypress'], {
		stdio: 'inherit',
	});
	await execa('nx', ['add', '@nx/storybook', '--interactive=false'], { stdio: 'inherit' });
	await execa('nx', ['generate', '@nx/express:init'], { stdio: 'inherit' });
	await execa('nx', ['generate', '@nx/react:init'], { stdio: 'inherit' });
	await execa('nx', ['generate', '@nx/storybook:init'], { stdio: 'inherit' });
	await execa('nx', ['generate', '@nx/cypress:init'], { stdio: 'inherit' });

	// 4) generate React + Express apps
	console.log('🔨 Generating React client app…');
	await execa(
		'nx',
		[
			'generate',
			'@nx/react:application',
			'client',
			'--directory=apps',
			'--routing',
			'--style=css',
			'--unitTestRunner=jest',
			'--e2eTestRunner=none',
			'--linter=eslint',
			'--no-interactive',
		],
		{ stdio: 'inherit' }
	);

	console.log('🔨 Generating Express API app…');
	await execa('nx', ['generate', '@nx/express:application', 'api', '--directory=apps', '--no-interactive'], {
		stdio: 'inherit',
	});

	// 5) generate the UI library under libs/ui
	console.log('🔨 Generating UI library…');
	await execa(
		'nx',
		[
			'generate',
			'@nx/react:library',
			'ui',
			'--directory=libs',
			'--style=css',
			'--unitTestRunner=jest',
			'--linter=eslint',
			'--bundler=none',
			'--no-interactive',
		],
		{ stdio: 'inherit' }
	);

	// 6) wire up Storybook against the actual project name
	console.log('🔨 Configuring Storybook for UI library…');

	// load workspace.json (Nx < 15) or nx.json (Nx ≥ 15)
	const wsJsonPath = join(process.cwd(), 'workspace.json');
	const nxJsonPath = join(process.cwd(), 'nx.json');
	let projects: Record<string, any> = {};

	if (existsSync(wsJsonPath)) {
		const ws = JSON.parse(readFileSync(wsJsonPath, 'utf-8'));
		projects = ws.projects;
	} else if (existsSync(nxJsonPath)) {
		const nx = JSON.parse(readFileSync(nxJsonPath, 'utf-8'));
		projects = nx.projects;
	} else {
		console.error('❌ Could not locate workspace.json or nx.json');
		process.exit(1);
	}

	// find the entry whose root is "libs/ui"
	const entry = Object.entries(projects).find(([_, cfg]) => cfg.root === 'libs/ui');

	if (!entry) {
		console.error('❌ Unable to find a project with root "libs/ui"');
		process.exit(1);
	}

	const [uiProjectName] = entry;

	// now generate Storybook against that actual name
	await execa(
		'nx',
		[
			'generate',
			'@nx/react:storybook-configuration',
			uiProjectName,
			'--uiFramework=@storybook/react-webpack5',
			'--generateCypressSpecs=false',
			'--no-interactive',
		],
		{ stdio: 'inherit' }
	);

	console.log('✅ Done! Your workspace is ready.');
}
