import resolvePkg from 'resolve-pkg';
import { readFileSync } from 'fs';
import { join } from 'path';

interface ResolvedPackage {
  name: string;
  path: string;
}

export function getPackagePaths(
  basePath: string,
  deps: string[],
  resolved: ResolvedPackage[] = [],
) {
  for (const dep of deps) {
    const path = resolvePkg(dep, { cwd: basePath });

    if (path) {
      if (!hasPath(resolved, path)) {
        resolved.push({ name: dep, path });
      }

      const pkg = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'));
      getPackagePaths(path, Object.keys(pkg.dependencies || {}), resolved);
    } else {
      throw new Error(`Unresolvable dependency ${dep}`);
    }
  }

  return resolved;
}

function hasPath(packages: ResolvedPackage[], toFind: string) {
  return (
    packages.find(({ path }) => {
      return path === toFind || toFind.startsWith(path + '/');
    }) != null
  );
}
