import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BacktraceReport } from '../model/backtraceReport';
import { VERSION } from '../const/application';

/**
 * Read module dependencies
 */
export function readModuleDependencies(modulePath: string): object | undefined {
  if (!modulePath) {
    return undefined;
  }
  const packageJson = require(modulePath);
  return {
    requestedVersions: packageJson.dependencies || packageJson.peerDependencies || packageJson.devDependencies,
    devDependencies: packageJson.devDependencies,
  };
}

export function readModule(root: string | undefined, depth: number = 10): [NodeRequire, string] {
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
  console.warn('reading Backtrace module - cannot find correct module');
  return require('../../package.json');
}
function readParentDir(root: string, depth: number) {
  const parent = path.join(root, '..');
  return readModule(parent, --depth);
}

export function readSystemAttributes(): { [index: string]: any } {
  const mem = process.memoryUsage();
  const result = {
    'process.age': Math.floor(process.uptime()),
    'uname.uptime': os.uptime(),
    'uname.machine': process.arch,
    'uname.version': os.release(),
    'uname.sysname': process.platform,
    'vm.rss.size': mem.rss,
    'gc.heap.total': mem.heapTotal,
    'gc.heap.used': mem.heapUsed,
    'node.env': process.env.NODE_ENV,
    'debug.port': process.debugPort,
    'backtrace.version': VERSION,
    guid: BacktraceReport.machineId,
    hostname: os.hostname(),
  } as any;

  const cpus = os.cpus();
  if (cpus && cpus.length > 0) {
    result['cpu.count'] = cpus.length;
    result['cpu.brand'] = cpus[0].model;
  }
  return result;
}
