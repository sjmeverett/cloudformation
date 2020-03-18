import resolvePkg from 'resolve-pkg';
import { readFileSync } from 'fs';
import { join } from 'path';

export function getPackagePaths(
  basePath: string,
  deps: string[],
  paths: string[],
) {
  for (const dep of deps) {
    const path = resolvePkg(dep, { cwd: basePath });

    if (path && !hasPath(paths, path)) {
      paths.push(path);

      const pkg = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'));
      getPackagePaths(path, Object.keys(pkg.dependencies || {}), paths);
    }
  }
}

function hasPath(paths: string[], toFind: string) {
  return (
    paths.find(path => {
      return path === toFind || toFind.startsWith(path + '/');
    }) != null
  );
}
