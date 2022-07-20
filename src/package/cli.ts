#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { FetchCrunchNode } from "./node.js";

interface PackageJson {
	version: string;
	name: string;
	description: string;
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
${pkgMeta.description}

Usage:
  ${pkgMeta.name} [OPTIONS]

Reads the input from stdin and returns the output into stdout, classic UNIX style.

Options:
  --template=    Specify template. Be careful with shell quotes!
  --iterations=  Zopfli # of iterations. Default is 50.

Options for the curious ones:
  --version      Print version and exit.
  --help         This help. \uD83D\uDE01

Options for the desperate ones:
  --direct-eval  \u26A0 May significantly slow down your demo!
                 Use eval() directly without wrapping it into the (0,eval). See:
                 https://262.ecma-international.org/13.0/#step-callexpression-evaluation-direct-eval
				 
  --empty-url    \u26A0 Will not work with data: and blob: URLs!
                 Use the empty string as as self-fetch URL.

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
	let template: string | undefined;
	let iterations: number | undefined;
	let directEval: boolean = false;
	let emptyUrl: boolean = false;

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
			if (process.argv[i].startsWith('--template=')) {
				template = process.argv[i].slice('--template='.length);
				continue;
			}
			if (process.argv[i].startsWith('--iterations=')) {
				const iterationsStr = process.argv[i].slice('--iterations='.length);
				iterations = Math.ceil(Number(iterationsStr));
				if (!iterationsStr || !Number.isFinite(iterations) || iterations <= 0) {
					process.stderr.write(`Invalid option value: ${process.argv[i]}. Run with --help for help.\n`);		
				}
				continue;
			}
			if (process.argv[i] === '--direct-eval') {
				directEval = true;
				continue;
			}
			if (process.argv[i] === '--empty-url') {
				emptyUrl = true;
				continue;
			}

			process.stderr.write(`Unknown option: ${process.argv[i]}. Run with --help for help.\n`);
			process.exit(1);
			throw new Error('How did you get there?');
		}
	}

	const stdin = await readStdin();

	const FetchCrunchCli = class extends FetchCrunchNode {
		protected override _htmlTemplate(): string {
			return template ?? super._htmlTemplate();
		}
		protected override _zopfliIterations(): number {
			return iterations ?? super._zopfliIterations();
		}
		protected override _useDirectEval(): boolean {
			return directEval ? true : super._useDirectEval();
		}
		protected override _selfFetchUrl(): string {
			return emptyUrl ? '' : super._selfFetchUrl();
		}
	}

	const fetchCrunch = new FetchCrunchCli();
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
