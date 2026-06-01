```js id="cwn8oe"
// File Operations Utilities

import fs from 'fs-extra';
import path from 'path';

/* -------------------------------------------------------
   CONSTANTS
------------------------------------------------------- */

const MAX_BACKUPS = 5;

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

/**
 * Generate timestamped backup filename.
 *
 * @param {string} filePath
 * @returns {string}
 */
function generateBackupPath(filePath) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-');

  return `${filePath}.${timestamp}.backup`;
}

/**
 * Ensure parent directory exists.
 *
 * @param {string} filePath
 */
async function ensureParentDirectory(filePath) {
  await fs.ensureDir(path.dirname(filePath));
}

/**
 * Cleanup old backups while keeping latest N backups.
 *
 * @param {string} filePath
 */
async function cleanupOldBackups(filePath) {
  const dir = path.dirname(filePath);
  const fileName = path.basename(filePath);

  const files = await fs.readdir(dir);

  const backupFiles = files
    .filter(file =>
      file.startsWith(fileName) &&
      file.endsWith('.backup')
    )
    .sort()
    .reverse();

  const oldBackups = backupFiles.slice(MAX_BACKUPS);

  for (const backup of oldBackups) {
    await fs.remove(path.join(dir, backup));
  }
}

/* -------------------------------------------------------
   BACKUP SYSTEM
------------------------------------------------------- */

/**
 * Create timestamped backup of file.
 *
 * @param {string} filePath
 * @returns {Promise<string|null>}
 */
async function backupFile(filePath) {

  const exists = await fs.pathExists(filePath);

  if (!exists) {
    return null;
  }

  const backupPath = generateBackupPath(filePath);

  await fs.copy(filePath, backupPath);

  await cleanupOldBackups(filePath);

  return backupPath;
}

/* -------------------------------------------------------
   JSON UTILITIES
------------------------------------------------------- */

/**
 * Read JSON file safely.
 *
 * @param {string} filePath
 * @returns {Promise<Object|null>}
 */
async function readJsonFile(filePath) {
  try {

    const exists = await fs.pathExists(filePath);

    if (!exists) {
      return null;
    }

    return await fs.readJson(filePath);

  } catch (error) {

    throw new Error(
      `Failed to read JSON file "${filePath}": ${error.message}`
    );
  }
}

/**
 * Write JSON file safely with automatic backup support.
 *
 * @param {string} filePath
 * @param {Object} data
 * @param {Object} [options]
 * @param {boolean} [options.backup=true]
 * @returns {Promise<boolean>}
 */
async function writeJsonFile(
  filePath,
  data,
  options = {}
) {

  const {
    backup = true
  } = options;

  try {

    await ensureParentDirectory(filePath);

    if (backup) {
      await backupFile(filePath);
    }

    await fs.writeJson(
      filePath,
      data,
      {
        spaces: 2
      }
    );

    return true;

  } catch (error) {

    throw new Error(
      `Failed to write JSON file "${filePath}": ${error.message}`
    );
  }
}

/* -------------------------------------------------------
   TOML UTILITIES
------------------------------------------------------- */

/**
 * Read TOML file safely.
 *
 * @param {string} filePath
 * @returns {Promise<Object|null>}
 */
async function readTomlFile(filePath) {

  try {

    const exists = await fs.pathExists(filePath);

    if (!exists) {
      return null;
    }

    const TOML = await import('@iarna/toml');

    const content = await fs.readFile(
      filePath,
      'utf8'
    );

    return TOML.parse(content);

  } catch (error) {

    throw new Error(
      `Failed to read TOML file "${filePath}": ${error.message}`
    );
  }
}

/**
 * Write TOML file safely with automatic backup support.
 *
 * @param {string} filePath
 * @param {Object} data
 * @param {Object} [options]
 * @param {boolean} [options.backup=true]
 * @returns {Promise<boolean>}
 */
async function writeTomlFile(
  filePath,
  data,
  options = {}
) {

  const {
    backup = true
  } = options;

  try {

    const TOML = await import('@iarna/toml');

    await ensureParentDirectory(filePath);

    if (backup) {
      await backupFile(filePath);
    }

    const tomlContent = TOML.stringify(data);

    await fs.writeFile(
      filePath,
      tomlContent,
      'utf8'
    );

    return true;

  } catch (error) {

    throw new Error(
      `Failed to write TOML file "${filePath}": ${error.message}`
    );
  }
}

/* -------------------------------------------------------
   CONFIG MERGING
------------------------------------------------------- */

/**
 * Deep merge configuration objects.
 *
 * @param {Object} existingData
 * @param {Object} newData
 * @returns {Promise<Object>}
 */
async function mergeJsonConfig(
  existingData = {},
  newData = {}
) {

  const merged = {
    ...existingData
  };

  for (const key in newData) {

    const existingValue = merged[key];
    const incomingValue = newData[key];

    const isObject =
      typeof incomingValue === 'object' &&
      incomingValue !== null &&
      !Array.isArray(incomingValue);

    if (isObject) {

      merged[key] = {
        ...(existingValue || {}),
        ...incomingValue
      };

    } else {

      merged[key] = incomingValue;
    }
  }

  return merged;
}

/* -------------------------------------------------------
   DIRECTORY UTILITIES
------------------------------------------------------- */

/**
 * Ensure directory exists.
 *
 * @param {string} dirPath
 */
async function ensureDirectory(dirPath) {
  await fs.ensureDir(dirPath);
}

/* -------------------------------------------------------
   EXPORTS
------------------------------------------------------- */

export {
  readJsonFile,
  writeJsonFile,
  readTomlFile,
  writeTomlFile,
  mergeJsonConfig,
  ensureDirectory,
  backupFile,
  generateBackupPath,
  cleanupOldBackups
};
```
