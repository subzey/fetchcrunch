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
			'<svg onload=__bootstrap__>',
			'<body onload="__bootstrap__">',
			'<canvas id="a"><svg onload="__bootstrap__">',
			'<h1>CLICK<canvas id="a"><body onload="__bootstrap__">',
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


function * findIndices(haystack, needle) {
	let i = -1;
	while (true) {
		i = haystack.indexOf(needle, i + 1);
		if (i === -1) {
			break;
		}
		yield i;
	}
}

async function inference() {
	for (const varname of ['a', 'b', 'c']) {
		const input = `=>${varname}.read().then`;

		class WithCustomTemplate extends FetchCrunchNode {
			_htmlTemplate() {
				return `<canvas id="${varname}"><svg onload=__bootstrap__>`;
			}
		}

		const vanilla = inflateRawSync(await new FetchCrunchNode().crunch(input)).toString();
		const custom = inflateRawSync(await new WithCustomTemplate().crunch(input)).toString();

		if ([...findIndices(vanilla, input)].length < 2) {
			debugger;
			throw new Error('The bootstrap variable name should be inferred from input');
		}
		if ([...findIndices(custom, input)].length > 1) {
			debugger;
			throw new Error('An id mentioned in the template should not be used in the bootstrap');
		}
	}
}

function usesCharCodeBootstrap(crunched) {
	return Buffer.from(crunched).toString().includes('String.fromCharCode(');
}

async function stringDecoding() {
	const maxCallStackSize = 1000;
	class WithLimitedCallStack extends FetchCrunchNode {
		_maxCallStackSize() {
			return maxCallStackSize;
		}
	}
	const fetchcrunch = new WithLimitedCallStack();

	let basePayloadLength = 100; // Start with a 2x undershoot
	{
		const crunched = await fetchcrunch.crunch('0'.repeat(basePayloadLength));
		const actualDecompressedSize = inflateRawSync(crunched).byteLength;
		// Make the payload length near the call stack size boundary
		basePayloadLength -= (actualDecompressedSize - maxCallStackSize);
	}

	for (let delta = 2; delta >= -2; delta--) {
		const payloadLength = basePayloadLength + delta;
		const crunched = await fetchcrunch.crunch('0'.repeat(payloadLength));
		const actualDecompressedSize = inflateRawSync(crunched).byteLength;

		if (actualDecompressedSize > maxCallStackSize) {
			if (usesCharCodeBootstrap(crunched)) {
				throw new Error('The TextDecoder bootstrap should be used if compressed size > max call stack size');
			}
		} else {
			if (!usesCharCodeBootstrap(crunched)) {
				throw new Error('The charCode bootstrap should be used if compressed size <= max call stack size');
			}
		}
	}

	{ // charCodes in range 0..255
		const inRange = String.fromCharCode(...Array.from(Array(256), (_, i) => i));

		if (!usesCharCodeBootstrap(await fetchcrunch.crunch(inRange))) {
			throw new Error('The charCode bootstrap should be used for charCodes 0..255.');
		}
	}

	{ // charCodes in range 1..256
		const outOfRange = String.fromCharCode(...Array.from(Array(256), (_, i) => i + 1));
		if (usesCharCodeBootstrap(await fetchcrunch.crunch(outOfRange))) {
			throw new Error('The TextDecoder bootstrap should be used for charCodes > 255.');
		}
	}
}

async function main() {
	await smoke();
	await jumbo();
	await inference();
	await stringDecoding();
}

main().then(
	() => { console.log('Tests OK') },
	(reason) => {
		console.error(reason);
		process.exit(1);
	}
);
