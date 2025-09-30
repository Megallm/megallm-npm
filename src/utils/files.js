// File Operations Utilities
import fs from 'fs-extra';
import path from 'path';

async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // File doesn't exist
    }
    throw error;
  }
}

async function writeJsonFile(filePath, data, backup = true) {
  try {
    // Create directory if it doesn't exist
    await fs.ensureDir(path.dirname(filePath));

    // Backup existing file if requested
    if (backup && await fs.pathExists(filePath)) {
      const backupPath = `${filePath}.bak`;
      await fs.copy(filePath, backupPath);
    }

    // Write the file with proper formatting
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    throw error;
  }
}

async function readTomlFile(filePath) {
  try {
    const TOML = await import('@iarna/toml');
    const content = await fs.readFile(filePath, 'utf8');
    return TOML.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // File doesn't exist
    }
    throw error;
  }
}

async function writeTomlFile(filePath, data, backup = true) {
  try {
    const TOML = await import('@iarna/toml');

    // Create directory if it doesn't exist
    await fs.ensureDir(path.dirname(filePath));

    // Backup existing file if requested
    if (backup && await fs.pathExists(filePath)) {
      const backupPath = `${filePath}.bak`;
      await fs.copy(filePath, backupPath);
    }

    // Convert to TOML and write
    const tomlContent = TOML.stringify(data);
    await fs.writeFile(filePath, tomlContent);
    return true;
  } catch (error) {
    throw error;
  }
}

async function mergeJsonConfig(existingData, newData) {
  // Deep merge configuration objects
  const merged = { ...existingData };

  for (const key in newData) {
    if (typeof newData[key] === 'object' && !Array.isArray(newData[key]) && newData[key] !== null) {
      merged[key] = merged[key] || {};
      merged[key] = { ...merged[key], ...newData[key] };
    } else {
      merged[key] = newData[key];
    }
  }

  return merged;
}

async function ensureDirectory(dirPath) {
  await fs.ensureDir(dirPath);
}

async function backupFile(filePath) {
  if (await fs.pathExists(filePath)) {
    const backupPath = `${filePath}.bak`;
    await fs.copy(filePath, backupPath);
    return backupPath;
  }
  return null;
}

export { readJsonFile };
export { writeJsonFile };
export { readTomlFile };
export { writeTomlFile };
export { mergeJsonConfig };
export { ensureDirectory };
export { backupFile };