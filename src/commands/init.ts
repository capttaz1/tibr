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
			describe: 'Preset to use (e.g., apps, react, ts)',
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

	// TODO: add plugin installation or other setup steps here

	console.log('✅ Done! Your workspace is ready.');
}
