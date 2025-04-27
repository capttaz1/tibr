#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { initHandler } from './commands/init';

yargs(hideBin(process.argv))
	.command(
		'init <name>',
		'Bootstrap a new Nx workspace + apps/libs',
		(y) =>
			y
				.positional('name', {
					describe: 'The name (and folder) of your new workspace',
					type: 'string',
					demandOption: true,
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
				}),
		async (argv) => {
			const name = argv.name;
			// narrow these down from string → your exact unions:
			const preset = argv.preset as 'react-monorepo' | 'ts';
			const pm = argv.pm as 'npm' | 'yarn' | 'pnpm';
			await initHandler(name, preset, pm);
		}
	)
	.demandCommand(1, 'You need to specify a command')
	.strictCommands()
	.help()
	.parse();
