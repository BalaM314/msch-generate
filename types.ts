import { Rotation } from "msch";

export interface SchematicData {
	/**Contains metadata like name, description, authors, and version. */
	info: {
		name: string;
		description?: string;
		authors: string[];
		version: string;
		tags?: {
			[name: string]: string;
		};
	}
	tiles: {
		/**A grid of block names that specifies how your schematic is laid out. */
		grid: string[][];
		/**A list mapping block names to configs. */
		blocks: {
			[name: string]: SchematicBlockConfig | undefined;
		};
		/**A list of mlog programs. */
		programs: {
			/**If an array, interpreted as a program, otherwise interpreted as a path to a program. */
			[name: string]: string[] | string | undefined;
		}
	}
	/**
	 * A list of constants that will replace text in your schematic.
	 * Example: the line `"foo": "bar"` will cause any text that says "$foo" to be replaced with "bar".
	 */
	consts: {
		[name: string]: string | undefined;
	}
};
/**Represents the configuration of a block. */
export interface SchematicBlockConfig {
	/**The Mindustry block id. Example: conveyor large-surge-wall micro-processor */
	id: string;
	/**List of links. Unlike in a regular schematic, this is for processor and power node links. */
	links?: string[];
	config?: {
		type: TileConfigType;
		value: string;
	};//this may or may not work
	rotation?: Rotation;
}

export enum TileConfigType {
	"item",
	"program",
	"point"
}
