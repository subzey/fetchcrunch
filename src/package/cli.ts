#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { FetchCrunchNode } from "./node.js";

interface PackageJson {
	version: string;
	name: string;
}

function printPrompt() {
	const ansiFancyColor = '\u001b[33m';
	const ansiBold = '\u001b[1m';
	const ansiNotBold = '\u001b[22m';
	const ansiReset = '\u001b[m';

	process.stderr.write(`\
${ansiFancyColor}Type your JS code here and press ${ansiBold}Ctrl + D${ansiNotBold} when ready.
Or, you can press ${ansiBold}Ctrl + C${ansiNotBold} to abort now and use files instead:
${ansiBold}fetchcrunch <${ansiNotBold}input.js ${ansiBold}>${ansiNotBold}output.html${ansiReset}
`);
}

async function getPkgMeta(): Promise<PackageJson> {
	return JSON.parse(await readFile(fileURLToPath(new URL('./package.json', import.meta.url)), { encoding: 'utf-8' }));
}

async function printVersion() {
	process.stdout.write(`${(await getPkgMeta()).version}\n`);
}


async function printHelp() {
	const pkgMeta = await getPkgMeta();
	process.stderr.write(`\
FetchCrunch v${pkgMeta.version}

Wraps arbitrary JS code into a HTML page using DEFLATE compression.
Reads the input from stdin and returns the output into stdout, classic UNIX style.

Usage:
  ${pkgMeta.name} [OPTIONS]

Options:
  --help     This help. \uD83D\uDE01

There are no other CLI options so far.
Since you are here, I assume you're a JavaScript developer. Feel free to extend the FetchCrunchNode class and use it with your own tweaks:
  import { FetchCrunchNode } from '${pkgMeta.name}';
`);
}

async function readStdin(): Promise<string> {
	if (process.stdin.isTTY) {
		printPrompt();
	}
	const chunks = [];
	for await (const chunk of process.stdin) {
		chunks.push(chunk);
	}
	const asString = Buffer.concat(chunks).toString('utf-8');
	return asString.replace(/^[;\s]+/, '').replace(/[;\s]+$/, '');
}

async function main(): Promise<void> {
	if (process.argv.length > 2) {
		if (process.argv.indexOf('--help') >= 2) {
			await printHelp();
			return;
		}
		for (let i = 2; i < process.argv.length; i++) {
			if (process.argv[i] === '--version') {
				await printVersion();
				return;
			}
			process.stderr.write(`Unknown option: ${process.argv[i]}. Run with --help for help.\n`);
			process.exit(1);
			throw new Error('How did you get there?');
		}
	}


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

	return;
}

main();
