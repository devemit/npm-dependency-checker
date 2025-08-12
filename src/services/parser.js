const fs = require('fs/promises');
const path = require('path');
const semver = require('semver');

class PackageParser {
   constructor() {
      this.dependencyTypes = [
         'dependencies',
         'devDependencies',
         'peerDependencies',
         'optionalDependencies',
      ];
   }

   /**
    * Parse package.json file with error handling
    */
   async parsePackageJson(filePath) {
      try {
         const content = await fs.readFile(filePath, 'utf8');
         const packageJson = JSON.parse(content);

         return {
            success: true,
            data: packageJson,
            path: filePath,
            error: null,
         };
      } catch (error) {
         return {
            success: false,
            data: null,
            path: filePath,
            error: error.message,
         };
      }
   }

   /**
    * Extract all dependencies from package.json
    */
   extractDependencies(packageJson) {
      const dependencies = new Map();

      for (const depType of this.dependencyTypes) {
         const deps = packageJson[depType];
         if (deps && typeof deps === 'object') {
            for (const [name, version] of Object.entries(deps)) {
               dependencies.set(name, {
                  name,
                  version,
                  type: depType,
                  range: this.parseVersionRange(version),
               });
            }
         }
      }

      return dependencies;
   }

   /**
    * Parse version range and extract useful information
    */
   parseVersionRange(version) {
      const clean = semver.clean(version);
      const valid = semver.valid(clean);
      const range = semver.validRange(version);

      return {
         original: version,
         clean: clean,
         valid: valid,
         range: range,
         isExact: valid !== null,
         isRange: range !== null && valid === null,
         major: valid ? semver.major(valid) : null,
         minor: valid ? semver.minor(valid) : null,
         patch: valid ? semver.patch(valid) : null,
      };
   }

   /**
    * Get dependency statistics
    */
   getDependencyStats(packageJson) {
      const dependencies = this.extractDependencies(packageJson);
      const stats = {
         total: dependencies.size,
         byType: {},
         exactVersions: 0,
         rangeVersions: 0,
         invalidVersions: 0,
      };

      for (const dep of dependencies.values()) {
         // Count by type
         stats.byType[dep.type] = (stats.byType[dep.type] || 0) + 1;

         // Count by version type
         if (dep.range.isExact) {
            stats.exactVersions++;
         } else if (dep.range.isRange) {
            stats.rangeVersions++;
         } else {
            stats.invalidVersions++;
         }
      }

      return stats;
   }
}

module.exports = PackageParser;
