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

	// 5) generate the UI lib under libs/ui
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

	// 6) find its true project name
	console.log('🔨 Configuring Storybook for UI library…');
	const wsJsonPath = join(process.cwd(), 'workspace.json');
	let uiProjectName: string | undefined;

	if (existsSync(wsJsonPath)) {
		// Nx < v16: workspace.json holds all the project defs
		const ws = JSON.parse(readFileSync(wsJsonPath, 'utf-8'));
		uiProjectName = Object.entries(ws.projects).find(([, cfg]: any) => cfg.root === 'libs/ui')?.[0];
	}

	if (!uiProjectName) {
		// Nx v16+: per-project project.json, so fall back to `nx show` calls
		const { stdout: projectsJson } = await execa('nx', ['show', 'projects', '--json']);
		const allProjects: string[] = JSON.parse(projectsJson);
		for (const name of allProjects) {
			const { stdout: projCfgJson } = await execa('nx', ['show', 'project', name, '--json']);
			const proj = JSON.parse(projCfgJson);
			if (proj.root === 'libs/ui') {
				uiProjectName = name;
				break;
			}
		}
	}

	if (!uiProjectName) {
		console.error('❌ Could not locate the UI library project at libs/ui');
		process.exit(1);
	}

	// 7) finally, configure Storybook against that project
	await execa(
		'nx',
		[
			'generate',
			'@nx/react:storybook-configuration',
			uiProjectName!,
			'--uiFramework=@storybook/react-webpack5',
			'--generateCypressSpecs=false',
			'--no-interactive',
		],
		{ stdio: 'inherit' }
	);

	console.log('✅ Done! Your workspace is ready.');
}
