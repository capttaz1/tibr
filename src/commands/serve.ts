#!/usr/bin/env node

import { execa } from 'execa';
import { Argv } from 'yargs';

export const command = 'serve';
export const desc = 'Serve all applications (client, API, etc.)';

export const builder = (yargs: Argv) =>
  yargs.option('all', {
    alias: 'a',
    type: 'boolean',
    default: true,
    describe: 'Run serve against all projects',
  });

export async function handler({ all }: { all: boolean }) {
  console.log('🚀 Starting all dev servers…');
  await execa(
    'npx',
    ['nx', 'run-many', '--target=serve', all ? '--all' : '', '--parallel'],
    { stdio: 'inherit' }
  );
}