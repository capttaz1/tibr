#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Argv } from 'yargs';
import { loadConfig, TibrConfig } from '../config';

export const command = 'generate migration <entity>';
export const desc = 'Generate a Postgres migration SQL file for a given entity';

export interface GenerateMigrationOptions {
	entity: string;
}

export const builder = (yargs: Argv) =>
	yargs.positional('entity', {
		describe: 'Name of the domain entity (e.g., User)',
		type: 'string',
		demandOption: true,
	});

export async function handler({ entity }: GenerateMigrationOptions) {
	const cfg: TibrConfig = loadConfig();
	const schemaPath = path.join(process.cwd(), 'libs', 'domain', 'src', 'lib', `${entity.toLowerCase()}.schema.json`);
	if (!fs.existsSync(schemaPath)) {
		console.error(`❌ Schema not found at ${schemaPath}`);
		process.exit(1);
	}

	const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
	const tableName = `${entity.toLowerCase()}s`;

	// Type mapping
	const typeMap: Record<string, string> = {
		string: 'text',
		integer: 'integer',
		number: 'integer',
		boolean: 'boolean',
		object: 'jsonb',
		array: 'jsonb',
	};

	// Extension for UUID generation
	const extensionStmt = 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";';

	// Enum type statements
	const enumStmts = Object.entries(schema.properties)
		.filter(([, prop]: any) => Array.isArray(prop.enum))
		.map(([name, prop]: any) => {
			const enumName = `${tableName}_${name}_enum`;
			const vals = prop.enum.map((v: string) => `'${v}'`).join(', ');
			return `CREATE TYPE IF NOT EXISTS ${enumName} AS ENUM (${vals});`;
		});

	// Base CREATE TABLE for 'id'
	const createTableStmt = `CREATE TABLE IF NOT EXISTS "${tableName}" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4()
);`;

	// Alter statements for each other field
	const alterStmts: string[] = Object.entries(schema.properties)
		.filter(([name]) => name !== 'id')
		.map(([name, prop]: any) => {
			let sqlType = typeMap[prop.type] || 'text';
			if (Array.isArray(prop.enum)) {
				sqlType = `${tableName}_${name}_enum`;
			}
			return `ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${name}" ${sqlType} NOT NULL;`;
		});

	// Combine all statements
	const statements = ['-- Auto-generated migration', extensionStmt, ...enumStmts, createTableStmt, ...alterStmts];
	const sql = statements.join('\n\n');

	// Write file
	const timestamp = new Date()
		.toISOString()
		.replace(/[-:TZ]/g, '')
		.slice(0, 14);
	const fileName = `${timestamp}_migrate_${tableName}.sql`;
	const migrationsDir = path.join(process.cwd(), cfg.dbLib || 'libs/data', 'migrations');
	if (!fs.existsSync(migrationsDir)) fs.mkdirSync(migrationsDir, { recursive: true });
	const filePath = path.join(migrationsDir, fileName);
	fs.writeFileSync(filePath, sql);

	console.log(`✅ Migration written to ${filePath}`);
}
