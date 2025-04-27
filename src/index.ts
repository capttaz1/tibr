#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { builder, command, desc, handler as initHandler } from './commands/init';

async function main() {
	await yargs(hideBin(process.argv))
		.command({
			command,
			describe: desc,
			builder,
			handler: initHandler,
		})
		.demandCommand(1, 'You need to specify at least one command')
		.strict()
		.help()
		.parse();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
