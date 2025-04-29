#!/usr/bin/env node

import { execa } from 'execa';
import { Argv } from 'yargs';
import * as path from 'path';

export const command = 'docker <action>';
export const desc = 'Manage Docker Compose stack (up, down)';

export const builder = (yargs: Argv) =>
  yargs.positional('action', {
    describe: 'docker-compose action',
    choices: ['up', 'down'] as const,
  });

export interface DockerOptions {
  action: 'up' | 'down';
}

export async function handler({ action }: DockerOptions) {
  const composeFile = path.join(process.cwd(), 'libs', 'data', 'docker-compose.yml');
  console.log(`🐳 docker-compose ${action} on ${composeFile}`);
  await execa('docker-compose', ['-f', composeFile, action, '-d'], { stdio: 'inherit' });
}