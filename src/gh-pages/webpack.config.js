import { URL, fileURLToPath } from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import * as Webpack from "webpack"; // For typings only

/** @type {Webpack.Configuration} */
export default {
	context: fileURLToPath(new URL('.', import.meta.url)),
	mode: 'development',
	devtool: false,
	entry: [
		'./main.ts',
	],
	output: {
		publicPath: './',
		path: fileURLToPath(new URL('../../build/', import.meta.url)),
		// filename: '[chunkhash].js',
	},
	resolve: {
		extensions: [".ts", ".js"]
	},
	module: {
		rules: [
			{
				test: /\.ts$/i,
				loader: "ts-loader"
			},
			{
				test: /\.css$/i,
				use: [
					MiniCssExtractPlugin.loader,
					'css-loader',
				],
			},
			{
				test: /\.wasm$/i,
				type: 'asset/resource',
			},
		]
	},
	plugins: [
		new MiniCssExtractPlugin(),
		new HtmlWebpackPlugin({
			filename: 'index.html',
			template: 'index.html',
		}),
	],
	optimization: {
		runtimeChunk: false,
		minimizer: [
			'...',
			new CssMinimizerPlugin(),
		]
	}
}