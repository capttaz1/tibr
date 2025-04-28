#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import {
	builder as initBuilder,
	command as initCommand,
	desc as initDesc,
	handler as initHandler,
	InitOptions,
} from './commands/init';

async function main() {
	try {
		await yargs(hideBin(process.argv))
			.command<InitOptions>(initCommand, initDesc, initBuilder, initHandler)
			.demandCommand(1, 'You need to specify at least one command')
			.strict()
			.help()
			.parseAsync();
	} catch (err) {
		console.error(err);
		process.exit(1);
	}
}

main();
