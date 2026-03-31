import fs from 'node:fs';
import path from 'node:path';

const FORMULARY_PATH = path.resolve('src/lib/data/formulary.json');

function validate() {
  console.log(`Validating ${FORMULARY_PATH}...`);

  let data;
  try {
    const rawData = fs.readFileSync(FORMULARY_PATH, 'utf8');
    data = JSON.parse(rawData);
  } catch (error) {
    console.error('FAILED: Invalid JSON syntax in formulary.json');
    console.error(error.message);
    process.exit(1);
  }

  if (!Array.isArray(data)) {
    console.error('FAILED: Formulary data must be an array');
    process.exit(1);
  }

  const requiredKeys = ['id', 'generic_name', 'dose_guideline', 'calculation_shortcut'];
  let errors = [];

  data.forEach((entry, index) => {
    const entryId = entry.id || `entry at index ${index}`;

    // Check for required keys
    requiredKeys.forEach(key => {
      if (!(key in entry)) {
        errors.push(`${entryId}: Missing required key "${key}"`);
      }
    });

    // Check calculation_shortcut type (string or null)
    if ('calculation_shortcut' in entry) {
      const type = typeof entry.calculation_shortcut;
      if (type !== 'string' && entry.calculation_shortcut !== null) {
        errors.push(`${entryId}: "calculation_shortcut" must be string or null (got ${type})`);
      }
    }
  });

  if (errors.length > 0) {
    console.error(`FAILED: Found ${errors.length} validation error(s):`);
    errors.forEach(err => console.error(` - ${err}`));
    process.exit(1);
  }

  console.log('PASSED: Formulary data is valid!');
}

validate();
