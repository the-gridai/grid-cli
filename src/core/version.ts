/**
 * Version management - single source of truth from package.json
 * 
 * All version references throughout the CLI should import from here.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache the version after first read
let cachedVersion: string | null = null;
let cachedPackageJson: Record<string, unknown> | null = null;

/**
 * Find the grid-cli root directory by looking for package.json
 */
export function findGridCliRoot(): string {
  // Start from current file and walk up to find package.json
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const packagePath = path.join(dir, 'package.json');
    if (fs.existsSync(packagePath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
        if (pkg.name === 'grid-cli') {
          return dir;
        }
      } catch {
        // Continue searching
      }
    }
    dir = path.dirname(dir);
  }
  // Fallback: current working directory
  return process.cwd();
}

/**
 * Get the package.json contents
 */
export function getPackageJson(): Record<string, unknown> {
  if (cachedPackageJson) {
    return cachedPackageJson;
  }
  
  const rootDir = findGridCliRoot();
  const packagePath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8')) as Record<string, unknown>;
  cachedPackageJson = pkg;
  return pkg;
}

/**
 * Get the current version from package.json
 * This is the single source of truth for version.
 */
export function getVersion(): string {
  if (cachedVersion) {
    return cachedVersion;
  }
  
  const pkg = getPackageJson();
  cachedVersion = pkg.version as string;
  return cachedVersion;
}

/**
 * Set a new version in package.json
 * @returns The new version string
 */
export function setVersion(newVersion: string): string {
  // Validate version format
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(newVersion)) {
    throw new Error(`Invalid version format: ${newVersion}. Expected format: x.y.z or x.y.z-prerelease`);
  }
  
  const rootDir = findGridCliRoot();
  const packagePath = path.join(rootDir, 'package.json');
  
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  pkg.version = newVersion;
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  
  // Clear cache
  cachedVersion = null;
  cachedPackageJson = null;
  
  return newVersion;
}

/**
 * Bump the version
 * @param type - 'major', 'minor', or 'patch'
 * @returns The new version string
 */
export function bumpVersion(type: 'major' | 'minor' | 'patch'): string {
  const current = getVersion();
  const [major, minor, patch] = current.split('.').map(Number);
  
  let newVersion: string;
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }
  
  return setVersion(newVersion);
}

// Export version as a constant for convenient imports
export const VERSION = getVersion();
