#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Argv } from 'yargs';

export const command = 'register routes';
export const desc = 'Generate or update libs/api/src/main.ts with dynamic route registration snippet';

export const builder = (yargs: Argv) => yargs;

export async function handler() {
	const mainPath = path.join(process.cwd(), 'libs', 'api', 'src', 'main.ts');
	if (!fs.existsSync(mainPath)) {
		console.error(`❌ main.ts not found at ${mainPath}`);
		process.exit(1);
	}

	const content = fs.readFileSync(mainPath, 'utf-8');
	const lines = content.split(/\r?\n/);
	const startTag = '// ─── DYNAMIC ROUTE REGISTRATION ─────────────────────────────────────────────';
	const endTag = '// └───────────────────────────────────────────────────────────────────────────────';

	const startIdx = lines.findIndex((line) => line.includes(startTag));
	const endIdx = lines.findIndex((line) => line.includes(endTag));

	if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
		console.error('⚠️ Registration block tags not found or malformed in main.ts.');
		process.exit(1);
	}

	// Build the dynamic registration snippet
	const snippetLines = [
		startTag,
		"const controllersDir = path.join(__dirname, 'app');",
		'fs.readdirSync(controllersDir, { withFileTypes: true })',
		'  .filter(d => d.isDirectory())',
		'  .forEach(d => {',
		"    const router = require(path.join(controllersDir, d.name, d.name + '.controller.js')).default;",
		"    app.use('/api/' + d.name + 's', router);",
		'  });',
		endTag,
	];

	// Replace old block with new snippet
	const newLines = [...lines.slice(0, startIdx), ...snippetLines, ...lines.slice(endIdx + 1)];

	fs.writeFileSync(mainPath, newLines.join('\n'));
	console.log(`✅ Updated route registration in ${mainPath}`);
}
