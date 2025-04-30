#!/usr/bin/env node

import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';
import { Argv } from 'yargs';
import { loadConfig } from '../config';

export const command = 'domains load';
export const desc = 'Load your domain dictionary (CSV or Excel) into the CLI runtime';

export const builder = (yargs: Argv) =>
	yargs.option('file', {
		alias: 'f',
		type: 'string',
		describe: 'Path to your domain-dictionary.csv (or .xlsx). If omitted, uses your .tibrrc.',
	});

export interface DomainsLoadOptions {
	file?: string;
}

export async function handler({ file }: DomainsLoadOptions) {
	const cfg = loadConfig();
	const filePath = file ?? cfg.domainDictionaryPath;
	const ext = path.extname(filePath).toLowerCase();

	let entries: Array<{ entity: string; description: string }> = [];

	if (ext === '.csv') {
		const raw = fs.readFileSync(filePath);
		const records = parse(raw, {
			bom: true, // strip UTF-8 BOM if present
			columns: true, // first line → headers
			skip_empty_lines: true,
			trim: true, // trim all cell values
		}) as Record<string, string>[];

		entries = records.map((r) => {
			const keys = Object.keys(r);
			const entityKey = keys.find((k) => k.toLowerCase() === 'entity');
			const descKey = keys.find((k) => k.toLowerCase() === 'description');
			if (!entityKey || !descKey) {
				console.error(`⚠️  Invalid CSV headers. Found: ${keys.join(', ')}`);
				process.exit(1);
			}
			return {
				entity: r[entityKey],
				description: r[descKey],
			};
		});
	} else {
		console.error('⚠️  Only CSV is supported right now.');
		process.exit(1);
	}

	console.log(`📖 Loaded ${entries.length} domain entries from ${filePath}:`);
	entries.forEach((e) => console.log(`  • ${e.entity}: ${e.description}`));

	// TODO: cache `entries` for later commands
}
