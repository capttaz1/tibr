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
  handler as genHandler,
  GenerateOptions,
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

async function main() {
  try {
    await yargs(hideBin(process.argv))
      .command<InitOptions>(initCommand, initDesc, initBuilder, initHandler)
      .command<GenerateOptions>(genCommand, genDesc, genBuilder, genHandler)
      .command(serveCommand, serveDesc, serveBuilder, serveHandler)
      .command(buildCommand, buildDesc, buildBuilder, buildHandler)
      .command(dockerCommand, dockerDesc, dockerBuilder, dockerHandler)
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
