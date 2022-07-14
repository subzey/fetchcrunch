import { inflateRawSync } from 'node:zlib';

import { FetchCrunchNode } from '../package/node.js';

async function smoke() {
	for (const input of [
		'alert("Hello world!")',
		'0'.repeat(1024),
		Buffer.alloc(1024).fill(49),
	]) {
		for (const template of [
			undefined,
			'<svg onload>',
			'<body onload>',
			'<canvas><svg onload>',
			'<canvas id="a"><svg onload>',
		]) {
			class Test extends FetchCrunchNode {
				_htmlTemplate() {
					return template ?? super._htmlTemplate();
				}
			}
			const crunched = await new Test().crunch(input);
			const decompressed = inflateRawSync(crunched);

			const payloadAsString = input.toString();
			const decompressedAsString = decompressed.toString();

			const decompressedCleaned = decompressedAsString.replace(/^.*?[\r\n\u2028\u2029]/, '');
			if (decompressedCleaned !== payloadAsString) {
				throw new Error('The decompressed JS doesn\'t match the input');
			}
		}
	}
}

async function jumbo() {
	/// should not choke on large inputs
	await new FetchCrunchNode().crunch(Buffer.alloc(1024 * 1024).fill(49));
}

async function inference() {
	for (const varname of ['a', 'b', 'c']) {
		const input = `async ${varname}=>{`;

		class WithCustomTemplate extends FetchCrunchNode {
			_htmlTemplate() {
				return `<canvas id="${varname}"><svg onload>`;
			}
		}

		const vanilla = inflateRawSync(await new FetchCrunchNode().crunch(input)).toString();
		const custom = inflateRawSync(await new WithCustomTemplate().crunch(input)).toString();

		if ([...vanilla.matchAll(input)].length < 2) {
			throw new Error('The bootstrap variable name should be inferred from input');
		}
		if ([...custom.matchAll(input)].length > 1) {
			throw new Error('An id mentioned in the template should not be used in the bootstrap');
		}
	}
}

async function main() {
	await smoke();
	await jumbo();
	await inference();
}

main().then(
	() => { console.log('Tests OK') },
	(reason) => {
		console.error(reason);
		process.exit(1);
	}
);
