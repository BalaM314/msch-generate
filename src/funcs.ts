

/**Parses icons out of the data in the icons.properties file from the Mindustry source code. */
export function parseIcons(data:string[]) {
	const icons: Record<string, string> = {};
	for(const line of data){
		if(line.length == 0) continue;
		try {
			const [key, value] = line.split("=") as [string, string];
			icons[
				"_" + value.split("|")[0]!.replaceAll("-","_")
			] = String.fromCodePoint(parseInt(key));
		} catch(err){
			if(!(err instanceof RangeError)){
				console.error(line);
				throw err;
			}
		}
	}
	return icons;
}

class Message extends Error {
	name = "Message";
}

export function fail(message:string):never {
	throw new Message(message);
}
export function crash(message:string):never {
	throw new Error(message);
}
export function impossible():never {
	throw new Error(`this shouldn't be possible...`);
}

/** `object` must not have any properties that are not specified in the type definition. */
export function getKey<T extends {}, K extends PropertyKey>(object:T, key:K):(T extends unknown ? T[K & keyof T] : never) | undefined {
	if(object instanceof Object)
		crash(`getKey() is unsafe on an object that inherits from Object.prototype, because it will cause type unsoundness if key is "__proto__" or "hasOwnProperty"`);
	return (object as never)[key] as (T extends unknown ? T[K & keyof T] : never) | undefined;
}

export function removeParams(object:{}, ...remove:string[]){
	return Object.fromEntries(Object.entries(object).filter(([k]) => !remove.includes(k)));
}

export function escapePUA(input:string):string {
	return input.replace(/[\uE800-\uF8FF]/g, c => `\\u${c.codePointAt(0)?.toString(16).toUpperCase()}`);
}

export function tryRunOr<T>(callback:() => T, errorHandler:(err:Message) => unknown):boolean {
	try {
		callback();
		return true;
	} catch(err){
		if(err instanceof Message){
			errorHandler(err);
			return false;
		} else throw err;
	}
}
