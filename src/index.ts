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

import {
	builder as genBuilder,
	command as genCommand,
	desc as genDesc,
	GenerateOptions,
	handler as genHandler,
} from './commands/generate';

import {
	builder as serveBuilder,
	command as serveCommand,
	desc as serveDesc,
	handler as serveHandler,
} from './commands/serve';

import {
	builder as buildBuilder,
	command as buildCommand,
	desc as buildDesc,
	handler as buildHandler,
} from './commands/build';

import {
	builder as dockerBuilder,
	command as dockerCommand,
	desc as dockerDesc,
	handler as dockerHandler,
} from './commands/docker';

import {
	builder as domainsBuilder,
	command as domainsCommand,
	desc as domainsDesc,
	handler as domainsHandler,
	DomainsLoadOptions,
} from './commands/domains';

import {
	builder as inferBuilder,
	command as inferCommand,
	desc as inferDesc,
	InferEntitiesOptions,
	handler as inferHandler,
} from './commands/infer-entities';

import {
	GenerateMigrationOptions,
	builder as migBuilder,
	command as migCommand,
	desc as migDesc,
	handler as migHandler,
} from './commands/generate-migration.js';

import {
	builder as migrateBuilder,
	command as migrateCommand,
	desc as migrateDesc,
	handler as migrateHandler,
	MigrateOptions,
} from './commands/migrate.js';

import {
	GenerateServiceOptions,
	builder as svcBuilder,
	command as svcCommand,
	desc as svcDesc,
	handler as svcHandler,
} from './commands/generate-service.js';

import {
	builder as regBuilder,
	command as regCommand,
	desc as regDesc,
	handler as regHandler,
} from './commands/register-routes.js';

import {
	builder as formBuilder,
	command as formCommand,
	desc as formDesc,
	handler as formHandler,
	GenerateFormOptions,
} from './commands/generate-form.js';

import {
	GeneratePageOptions,
	builder as pageBuilder,
	command as pageCommand,
	desc as pageDesc,
	handler as pageHandler,
} from './commands/generate-page.js';

async function main() {
	await yargs(hideBin(process.argv))
		.command<InitOptions>(initCommand, initDesc, initBuilder, initHandler)
		.command<GenerateOptions>(genCommand, genDesc, genBuilder, genHandler)
		.command<GenerateFormOptions>(formCommand, formDesc, formBuilder, formHandler)
		.command<GeneratePageOptions>(pageCommand, pageDesc, pageBuilder, pageHandler)
		.command<{ all: boolean }>(serveCommand, serveDesc, serveBuilder, serveHandler)
		.command<{ all: boolean }>(buildCommand, buildDesc, buildBuilder, buildHandler)
		.command<{ action: 'up' | 'down' }>(dockerCommand, dockerDesc, dockerBuilder, dockerHandler)
		.command<DomainsLoadOptions>(domainsCommand, domainsDesc, domainsBuilder, domainsHandler)
		.command<InferEntitiesOptions>(inferCommand, inferDesc, inferBuilder, inferHandler)
		.command<GenerateMigrationOptions>(migCommand, migDesc, migBuilder, migHandler)
		.command<MigrateOptions>(migrateCommand, migrateDesc, migrateBuilder, migrateHandler)
		.command<GenerateServiceOptions>(svcCommand, svcDesc, svcBuilder, svcHandler)
		.command(regCommand, regDesc, regBuilder, regHandler)
		.demandCommand(1, 'You need to specify at least one command')
		.strict()
		.help()
		.parseAsync();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
