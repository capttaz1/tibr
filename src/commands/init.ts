// commands/init.ts
import type { Argv } from 'yargs';

export interface InitOptions {
	name: string;
	preset: 'react-monorepo' | 'ts';
	pm: 'npm' | 'yarn' | 'pnpm';
}

export const command = 'init <name>';
export const describe = 'Bootstrap a new Nx workspace + apps/libs';

export const builder = (yargs: Argv): Argv<InitOptions> => {
	return yargs
		.positional('name', {
			describe: 'The name (and folder) of your new workspace',
			type: 'string',
			demandOption: true,
		})
		.option('preset', {
			alias: 'p',
			describe: 'create-nx-workspace preset',
			type: 'string',
			choices: ['react-monorepo', 'ts'] as const,
			default: 'react-monorepo',
		})
		.option('pm', {
			alias: 'm',
			describe: 'Package manager to use',
			type: 'string',
			choices: ['npm', 'yarn', 'pnpm'] as const,
			default: 'npm',
		}) as Argv<InitOptions>;
};

export const handler = async (argv: InitOptions) => {
	const { name, preset, pm } = argv;
	console.log(`Bootstrapping "${name}" with preset="${preset}", packageManager="${pm}"…`);
	// … your existing implementation here …
};
