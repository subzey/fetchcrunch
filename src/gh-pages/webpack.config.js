import { URL, fileURLToPath } from 'url';
import * as Webpack from "webpack"; // For typings only

/** @type {Webpack.Configuration} */
export default {
	context: fileURLToPath(new URL('.', import.meta.url)),
	mode: 'development',
	devtool: false,
	entry: [
		"./main.ts",
	],
	output: {
		path: fileURLToPath(new URL('../../build/', import.meta.url))
	},
	resolve: {
		extensions: [".ts", ".js"]
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				loader: "ts-loader"
			},
			{
				test: /\.wasm$/,
				type: 'asset/resource',
			},
		]
	},
	optimization: {
		runtimeChunk: false,
	}
}