import { FetchCrunchNode } from "./node.js";


async function readStdin() {
	if (process.stdin.isTTY) {
		process.stderr.write('Type or pipe...\n');
	}
	const chunks = [];
	for await (const chunk of process.stdin) {
		chunks.push(chunk);
	}
	return Buffer.concat(chunks);
}

async function main() {
	const stdin = await readStdin();
	const fetchCrunch = new FetchCrunchNode();
	process.stdout.write(fetchCrunch.crunch(stdin), () => {
		if (process.stdout.isTTY) {
			process.stderr.write('\n');
		}
	});
}

main();
