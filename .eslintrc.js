module.exports = {
  root: true,
  env: { browser: false, es6: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { project: ['./tsconfig.json'], sourceType: 'module', extraFileExtensions: ['.json'] },
  ignorePatterns: ['.eslintrc.js', 'copy-icons.js', 'dist/**', 'node_modules/**'],
  overrides: [
    {
      files: ['package.json'],
      plugins: ['eslint-plugin-n8n-nodes-base'],
      extends: ['plugin:n8n-nodes-base/community'],
      rules: { 'n8n-nodes-base/community-package-json-name-still-default': 'off' },
    },
    {
      files: ['./credentials/**/*.ts'],
      plugins: ['eslint-plugin-n8n-nodes-base'],
      extends: ['plugin:n8n-nodes-base/credentials'],
      rules: {
        // Main-repository rule ("Only applicable to nodes in the main
        // repository", per its own docs string). It demands a camelCase slug,
        // which directly contradicts cred-class-field-documentation-url-not-http-url,
        // the rule that DOES apply to community credentials and requires a real
        // URL. n8n's own community starter switches this one off.
        'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
      },
    },
    {
      files: ['./nodes/**/*.ts'],
      plugins: ['eslint-plugin-n8n-nodes-base'],
      extends: ['plugin:n8n-nodes-base/nodes'],
      rules: {
        // These two rules DIRECTLY CONTRADICT the @n8n/community-nodes ruleset
        // that the Creator Portal's scanner actually enforces
        // (`npx @n8n/scan-community-package`). eslint-plugin-n8n-nodes-base is
        // the older plugin and wants the string literal ['main']; the scanner's
        // `node-connection-type-literal` rule rejects that and requires
        // NodeConnectionTypes.Main. Submission is gated on the SCANNER, so the
        // enum wins and these are switched off. Do not "fix" this back.
        'n8n-nodes-base/node-class-description-inputs-wrong-regular-node': 'off',
        'n8n-nodes-base/node-class-description-outputs-wrong': 'off',
      },
    },
  ],
};
