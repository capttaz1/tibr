#!/usr/bin/env node

import { execa } from 'execa';
import fs from 'fs';
import path from 'path';
import { Argv } from 'yargs';
import { loadConfig, TibrConfig } from '../config';

export const command = 'migrate';
export const desc = 'Apply all pending SQL migrations to the database';

export interface MigrateOptions {
	dir?: string;
}

export const builder = (yargs: Argv) =>
	yargs.option('dir', {
		alias: 'd',
		type: 'string',
		describe: 'Path to the migrations directory (overrides .tibrrc)',
	});

export async function handler({ dir }: MigrateOptions) {
	const cfg: TibrConfig = loadConfig();

	// Determine migrations directory
	const migrationsDir = dir
		? path.resolve(process.cwd(), dir)
		: path.join(process.cwd(), cfg.dbLib || 'libs/data', 'migrations');
	if (!fs.existsSync(migrationsDir)) {
		console.error(`❌ Migrations directory not found: ${migrationsDir}`);
		process.exit(1);
	}

	// Read and sort .sql files
	const files = fs
		.readdirSync(migrationsDir)
		.filter((f) => f.endsWith('.sql'))
		.sort();
	if (files.length === 0) {
		console.log('🔍 No migrations found.');
		return;
	}

	// Determine database URL
	const databaseUrl = cfg.databaseUrl || process.env.DATABASE_URL;
	if (!databaseUrl) {
		console.error('❌ Missing database URL. Set DATABASE_URL env or add "databaseUrl" to .tibrrc.');
		process.exit(1);
	}

	// Apply each migration
	for (const file of files) {
		const filePath = path.join(migrationsDir, file);
		console.log(`🛠 Applying migration ${file}...`);
		await execa('psql', ['-d', databaseUrl, '-v', 'ON_ERROR_STOP=1', '-f', filePath], { stdio: 'inherit' });
	}

	console.log('✅ All migrations applied successfully.');
}
