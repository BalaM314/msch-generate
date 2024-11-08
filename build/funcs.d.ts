/**Parses icons out of the data in the icons.properties file from the Mindustry source code. */
export declare function parseIcons(data: string[]): {
    [id: string]: string;
};
declare class Message extends Error {
    name: string;
}
export declare function fail(message: string): never;
export declare function crash(message: string): never;
export declare function impossible(): never;
/** `object` must not have any properties that are not specified in the type definition. */
export declare function getKey<T extends {}, K extends PropertyKey>(object: T, key: K): (T extends unknown ? T[K & keyof T] : never) | undefined;
export declare function tryRunOr<T>(callback: () => T, errorHandler: (err: Message) => unknown): boolean;
export {};
