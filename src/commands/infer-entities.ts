#!/usr/bin/env node

import { parse } from 'csv-parse/sync';
import fs from 'fs';
import OpenAI from 'openai';
import path from 'path';
import { Argv } from 'yargs';
import { loadConfig } from '../config';

export const command = 'infer-entities [entities..]';
export const desc = 'Use AI to infer properties for domain entities and output JSON schema files';

export const builder = (yargs: Argv) =>
	yargs
		.positional('entities', {
			describe: 'List of entity names to infer (defaults to all entities in domain dictionary)',
			type: 'string',
			array: true,
		})
		.option('model', {
			alias: 'm',
			type: 'string',
			default: 'gpt-4',
			describe: 'OpenAI model to use for inference',
		});

export interface InferEntitiesOptions {
	entities?: string[];
	model: string;
}

export async function handler({ entities, model }: InferEntitiesOptions) {
	const cfg = loadConfig();
	const dictPath = cfg.domainDictionaryPath;
	const ext = path.extname(dictPath).toLowerCase();

	// Load domain entries from CSV
	let entries: Array<{ entity: string; description: string }> = [];
	if (ext === '.csv') {
		const raw = fs.readFileSync(dictPath);
		const records = parse(raw, {
			bom: true,
			columns: true,
			skip_empty_lines: true,
			trim: true,
		}) as Record<string, string>[];

		entries = records.map((r) => {
			const keys = Object.keys(r);
			const entityKey = keys.find((k) => k.toLowerCase() === 'entity');
			const descKey = keys.find((k) => k.toLowerCase() === 'description');
			if (!entityKey || !descKey) {
				console.error(`⚠️ Invalid CSV headers. Found: ${keys.join(', ')}`);
				process.exit(1);
			}
			return { entity: r[entityKey], description: r[descKey] };
		});
	} else {
		console.error('⚠️ Only CSV is supported for now.');
		process.exit(1);
	}

	// Filter specific entities if provided
	let target = entries;
	if (entities && entities.length > 0) {
		target = entries.filter((e) => entities.includes(e.entity));
	}

	if (target.length === 0) {
		console.error('❌ No matching entities found to infer.');
		process.exit(1);
	}

	// Ensure API key
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		console.error('❌ Missing OPENAI_API_KEY environment variable.');
		process.exit(1);
	}

	const openai = new OpenAI({ apiKey });

	for (const { entity, description } of target) {
		console.log(`🤖 Inferring properties for ${entity}...`);
		const prompt = `Given the following entity description, output a JSON array named properties where each item has { name: string, type: string, description: string }:\nEntity: ${entity}\nDescription: ${description}\nOutput only valid JSON.`;

		const response = await openai.chat.completions.create({
			model,
			messages: [
				{ role: 'system', content: 'You are a helpful assistant that outputs JSON.' },
				{ role: 'user', content: prompt },
			],
			temperature: 0.2,
		});

		// Validate response structure
		const choices = response.choices;
		if (!choices || choices.length === 0 || !choices[0].message || !choices[0].message.content) {
			console.error(`❌ No valid completion returned for ${entity}.`);
			process.exit(1);
		}

		const jsonText = choices[0].message.content.trim();
		let properties: Array<{ name: string; type: string; description: string }>;
		try {
			const parsed = JSON.parse(jsonText);
			properties = Array.isArray(parsed.properties) ? parsed.properties : parsed;
		} catch (error) {
			console.error(`❌ Failed to parse JSON for ${entity}:`, error);
			process.exit(1);
		}

		// Write out JSON schema
		const schemaDir = path.join(process.cwd(), 'libs', 'domain', 'src', 'lib');
		if (!fs.existsSync(schemaDir)) fs.mkdirSync(schemaDir, { recursive: true });
		const schemaPath = path.join(schemaDir, `${entity.toLowerCase()}.schema.json`);
		const schema = {
			title: entity,
			description,
			type: 'object',
			properties: properties.reduce((acc: any, p: any) => {
				acc[p.name] = { type: p.type, description: p.description };
				return acc;
			}, {}),
			required: properties.map((p: any) => p.name),
		};
		fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2));
		console.log(`✅ Wrote schema to ${schemaPath}`);
	}
}
