// src/config.ts
import { cosmiconfigSync } from 'cosmiconfig';

export interface TibrConfig {
	domainDictionaryPath: string;
	dictionaryFormat: 'csv' | 'xlsx' | string;
	dictionarySheetNames?: Record<string, string>;
	dbLib?: string;
	databaseUrl?: string;
	uiProject?: string;
}

const explorer = cosmiconfigSync('tibr', {
	searchPlaces: ['.tibrrc', 'tibr.json'],
});

export function loadConfig(): TibrConfig {
	const result = explorer.search(process.cwd());
	if (!result?.config) {
		console.error('❌ Could not find a .tibrrc or tibr.json in your project root.');
		process.exit(1);
	}
	return result.config as TibrConfig;
}
