module.exports = {
	env: {
		es2022: true,
		node: true,
	},
	parserOptions: {
		sourceType: 'module',
		ecmaVersion: 2022,
	},
	extends: ['eslint:recommended', 'plugin:prettier/recommended'],
	rules: {
		'no-async-promise-executor': 'off',
	},
};
