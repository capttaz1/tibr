import { execa } from 'execa';
import * as fs from 'fs';
import yargs from 'yargs';

export const command = 'init <name>';
export const desc = 'Bootstrap a new Nx workspace + apps/libs';

interface InitOptions {
	preset: string;
	pm: string;
}

export const builder = (yargs: yargs.Argv<any>) =>
	yargs
		.positional('name', { type: 'string', describe: 'The name of your workspace' })
		.option('preset', {
			alias: 'p',
			type: 'string',
			default: 'react-monorepo',
			describe: 'create-nx-workspace preset',
		})
		.option('pm', {
			alias: 'm',
			type: 'string',
			default: 'npm',
			describe: 'package manager to use',
		});

export async function handler(argv: yargs.Arguments<InitOptions>) {
	const name = argv.name as string;
	const preset = argv.preset;
	const pm = argv.pm;

	// 1. Remove existing folder if present
	if (fs.existsSync(name)) {
		fs.rmSync(name, { recursive: true, force: true });
		console.log(`🗑 Removed existing directory: ${name}`);
	}

	// 2. Bootstrap new Nx workspace
	await execa(
		'npx',
		[
			'create-nx-workspace@latest',
			name,
			'--preset',
			preset,
			'--packageManager',
			pm,
			'--interactive=false',
			'--nxCloud=false',
		],
		{ stdio: 'inherit' }
	);

	process.chdir(name);

	// 3. Install & initialize Nx plugins
	console.log('🔧 Installing & initializing Nx plugins…');
	await execa(
		pm,
		[
			'install',
			'@nx/express@latest',
			'@nx/react@latest',
			'@nx/storybook@latest',
			'@nx/cypress@latest',
			'--save-dev',
		],
		{ stdio: 'inherit' }
	);

	await execa('nx', ['g', '@nx/express:init', '--no-interactive'], { stdio: 'inherit' });
	await execa('nx', ['g', '@nx/react:init', '--no-interactive'], { stdio: 'inherit' });
	await execa('nx', ['g', '@nx/storybook:init', '--no-interactive'], { stdio: 'inherit' });
	await execa('nx', ['g', '@nx/cypress:init', '--no-interactive'], { stdio: 'inherit' });

	// 4. Generate applications and libs
	console.log('🔨 Generating React client app…');
	await execa(
		'nx',
		[
			'g',
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
	await execa('nx', ['g', '@nx/express:application', 'api', '--directory=apps', '--no-interactive'], {
		stdio: 'inherit',
	});

	console.log('🔨 Generating UI library…');
	await execa(
		'nx',
		[
			'g',
			'@nx/react:library',
			'ui',
			'--directory=libs',
			'--style=css',
			'--linter=eslint',
			'--unitTestRunner=jest',
			'--bundler=none',
			'--no-interactive',
		],
		{ stdio: 'inherit' }
	);

	// 5. Configure Storybook for the UI lib
	console.log('🔨 Configuring Storybook for UI library…');
	const uiProject = `@${name}/ui`;
	await execa(
		'nx',
		[
			'g',
			'@nx/react:storybook-configuration',
			uiProject,
			'--uiFramework=@storybook/react-webpack5',
			'--generateCypressSpecs=false',
			'--no-interactive',
		],
		{ stdio: 'inherit' }
	);

	console.log('🎉 Initialization complete!');
}

// alias the handler so index.ts can import initHandler
export const initHandler = handler;
