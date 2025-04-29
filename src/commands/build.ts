#!/usr/bin/env node

import { execa } from 'execa';
import { Argv } from 'yargs';

export const command = 'build';
export const desc = 'Build all projects';

export const builder = (yargs: Argv) =>
  yargs.option('all', {
    alias: 'a',
    type: 'boolean',
    default: true,
    describe: 'Build all projects',
  });

export async function handler({ all }: { all: boolean }) {
  console.log('🏗️  Building all projects…');
  await execa(
    'npx',
    ['nx', 'run-many', '--target=build', all ? '--all' : ''],
    { stdio: 'inherit' }
  );
}