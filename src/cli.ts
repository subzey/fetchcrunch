#!/usr/bin/env node

import { FetchCrunchNode } from "./node.js";

async function readStdin(): Promise<string> {
	if (process.stdin.isTTY) {
		const ansiFancyColor = '\u001b[33m';
		const ansiBold = '\u001b[1m';
		const ansiNotBold = '\u001b[22m';
		const ansiReset = '\u001b[m';

		process.stderr.write(`\
${ansiFancyColor}Type your JS code here and press ${ansiBold}Ctrl + D${ansiNotBold} when ready.
Or, you can press ${ansiBold}Ctrl + C${ansiNotBold} to abort now and use files instead:
    ${ansiBold}fetchcrunch <${ansiNotBold}source.js ${ansiBold}>${ansiNotBold}crunched.html${ansiReset}
`);
	}
	const chunks = [];
	for await (const chunk of process.stdin) {
		chunks.push(chunk);
	}
	const asString = Buffer.concat(chunks).toString('utf-8');
	return asString.replace(/^[;\s]+/, '').replace(/[;\s]+$/, '');
}

async function main(): Promise<void> {
	const stdin = await readStdin();
	const fetchCrunch = new FetchCrunchNode();
	process.stdout.write(
		await fetchCrunch.crunch(stdin),
		() => {
			if (process.stdout.isTTY && process.stdout.isTTY) {
				process.stderr.write('\n');
			}
		}
	);
}

main();
