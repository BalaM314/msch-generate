import { Rotation } from "msch";

export type SchematicData = {
	/**Contains metadata like name, description, authors, and version. */
	info: {
		name: string;
		description?: string;
		labels?: string[];
		authors: string[];
		version: string;
		tags?: Record<string, string>
	}
	tiles: {
		/**A grid of block names that specifies how your schematic is laid out. */
		grid: string[][];
		/**A list mapping block names to configs. */
		blocks: Record<string, SchematicBlockConfig>;
		/**A list of mlog programs. */
		programs?: Record<string, string[] | string>
	}
	/**
	 * A list of constants that will replace text in your schematic.
	 * Example: the line `"foo": "bar"` will cause any text that says "$foo" to be replaced with "bar".
	 */
	consts?: Record<string, string>
}
/**Represents the configuration of a block. */
export type SchematicBlockConfig = {
	/**The Mindustry block id. Example: conveyor large-surge-wall micro-processor */
	id: string;
	/**List of links. Unlike in a regular schematic, this is for processor AND power node links. */
	links?: string[];
	config?: {
		type: TileConfigType;
		value: string;
	}
	rotation?: Rotation;
}

export type TileConfigType =
| "item"
| "liquid"
| "unit"
| "block"
| "program"
| "point"
| "boolean"
| "string"
| "command"
;
