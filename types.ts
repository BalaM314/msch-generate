export interface SchematicData {
	info: {
		name: string;
		description?: string;
		authors: string[];
	}
	tiles: {
		grid: string[][];
		configs: {
			[name: string]: SchematicConfig;
		};
		programs: {
			[name: string]: string[] | string;//if string then interpret it as a path
		}
	}
	consts: {
		[name: string]: string;
	}
};
export interface SchematicConfig {
	id: string;
	links?: string[];
	config?: string | boolean;//this may or may not work
}