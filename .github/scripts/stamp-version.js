// Puts the version from a tag like v1.2.3 into the files the package takes its version from.
// SharePoint wants four numbers (1.2.3.0); package.json wants three.
const fs = require('fs');

const match = /^v(\d+\.\d+\.\d+)$/.exec(process.argv[2] || '');
if (!match) {
  console.error(`Expected a tag like v1.2.3, got "${process.argv[2] || ''}".`);
  process.exit(1);
}
const version = match[1];

const update = (file, change) => {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  change(json);
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
};

update('package.json', json => { json.version = version; });
update('config/package-solution.json', json => {
  json.solution.version = `${version}.0`;
  json.solution.features.forEach(feature => { feature.version = `${version}.0`; });
});

console.log(`Package version set to ${version}.0`);
