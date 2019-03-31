import * as fs from 'fs';
import * as path from 'path';

/**
 * Read module dependencies
 */
export function readModuleDependencies(path: string): object {
  const packageJson = require(path);
  return {
    requestedVersions:
      packageJson.dependencies ||
      packageJson.peerDependencies ||
      packageJson.devDependencies,
    devDependencies: packageJson.devDependencies,
  };
}

export function readModule(
  root: string,
  depth: number = 5
): [NodeRequire, string] {
  if (depth < 0) {
    return readLibModule();
  }
  if (!root) {
    root = process.cwd();
  }
  const filePath = fs.lstatSync(root).isFile();
  if (filePath) {
    root = path.dirname(root);
  }
  const modulePredictedPath = path.join(root, 'package.json');
  const exists = fs.existsSync(modulePredictedPath);
  if (!exists) {
    return readParentDir(root, depth);
  }
  try {
    return [require(modulePredictedPath), modulePredictedPath];
  } catch (err) {
    // possible solution that can goes wrong:
    // * not enough privileges to read module,
    // * cannot import module
    // * module not exists
    return readParentDir(root, depth);
  }
}

function readLibModule() {
  console.log('reading Backtrace module - cannot found correct module');
  return require('../../package.json');
}
function readParentDir(root: string, depth: number) {
  const parent = path.join(root, '..');
  return readModule(parent, --depth);
}
