import * as fs from 'fs';
import * as path from 'path';

/**
 * Read module dependencies
 */
export function readModuleDependencies(modulePath: string): object | undefined {
  if(!modulePath){
    return undefined;
  }
  const packageJson = require(modulePath);
  return {
    requestedVersions: packageJson.dependencies || packageJson.peerDependencies || packageJson.devDependencies,
    devDependencies: packageJson.devDependencies,
  };
}

export function readModule(root: string | undefined, depth: number = 5): [NodeRequire, string] {
  if (depth < 0) {
    return readLibModule();
  }
  if (!root) {
    root = process.cwd();
  }
  // solve problem when root module doesn't exists
  if (!fs.existsSync(root)) {
    return readParentDir(root, depth);
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
  console.warn('reading Backtrace module - cannot found correct module');
  return require('../../package.json');
}
function readParentDir(root: string, depth: number) {
  const parent = path.join(root, '..');
  return readModule(parent, --depth);
}
