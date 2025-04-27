// src/commands/init.ts

import { execa } from 'execa';
import * as fs from 'fs';
import inquirer from 'inquirer';
import * as path from 'path';

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

	// 5) generate UI library
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

	// 6) wire up Storybook
	console.log('🔨 Configuring Storybook for UI library…');
	await execa(
		'nx',
		[
			'generate',
			'@nx/react:storybook-configuration',
			'ui',
			'--uiFramework=@storybook/react-webpack5',
			'--generateCypressSpecs=false',
			'--no-interactive',
		],
		{ stdio: 'inherit' }
	);

	console.log('✅ Done! Your workspace is ready.');
}
