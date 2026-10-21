// Tests for preflight.yaml: every case from cases.yaml with its checks
// stripped, so no grader is called. The only assertion is that the provider
// returned something.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const cases = yaml.load(fs.readFileSync(path.join(__dirname, 'cases.yaml'), 'utf8'));

module.exports = cases.map((c) => ({
  description: c.description,
  metadata: c.metadata,
  vars: c.vars,
  assert: [{ type: 'javascript', value: 'output.trim().length > 0', metric: 'reachable' }],
}));
