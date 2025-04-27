import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { Argv } from 'yargs';

export interface InitOptions {
	name: string;
	preset: 'react-monorepo' | 'ts';
	pm: 'npm' | 'yarn' | 'pnpm';
}

export const command = 'init <name>';
export const desc = 'Bootstrap a new Nx workspace';

export function builder(yargs: Argv): Argv<InitOptions> {
	return yargs
		.positional('name', {
			describe: 'The name (and folder) of your new workspace',
			type: 'string',
		})
		.option('preset', {
			alias: 'p',
			describe: 'create-nx-workspace preset',
			choices: ['react-monorepo', 'ts'] as const,
			default: 'react-monorepo',
		})
		.option('pm', {
			alias: 'm',
			describe: 'Package manager to use',
			choices: ['npm', 'yarn', 'pnpm'] as const,
			default: 'npm',
		});
}

export async function handler(argv: InitOptions) {
	const { name, preset, pm } = argv;
	const targetDir = join(process.cwd(), name);

	// Remove existing dir if present
	if (existsSync(targetDir)) {
		console.log(`🗑 Removing existing workspace…`);
		rmSync(targetDir, { recursive: true, force: true });
	}

	console.log(`🚀 Bootstrapping "${name}" with preset="${preset}", packageManager="${pm}"…`);
	execSync(`npx create-nx-workspace@latest ${name} --preset=${preset} --packageManager=${pm} --interactive=false`, {
		stdio: 'inherit',
	});

	console.log('🎉 Done!');
}
