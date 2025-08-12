const ora = require('ora');
const chalk = require('chalk');
const path = require('path');
const semver = require('semver');
const NpmRegistryService = require('../services/npm-registry');
const PackageParser = require('../services/parser');
const { formatOutput } = require('../utils/output');

async function checkCommand(options) {
   const spinner = ora('Initializing dependency check...').start();

   try {
      // Initialize services
      const npmService = new NpmRegistryService({
         maxConcurrency: parseInt(options.parallel),
         cacheTTL: options.cache ? 3600 : 0, // Disable cache if --no-cache
      });

      const parser = new PackageParser();

      // Resolve package.json path
      const packagePath = path.resolve(options.path);
      spinner.text = `Reading package.json from ${packagePath}`;

      // Parse package.json
      const packageResult = await parser.parsePackageJson(packagePath);
      if (!packageResult.success) {
         spinner.fail(`Failed to read package.json: ${packageResult.error}`);
         process.exit(1);
      }

      const packageJson = packageResult.data;
      const dependencies = parser.extractDependencies(packageJson);

      if (dependencies.size === 0) {
         spinner.succeed('No dependencies found in package.json');
         return;
      }

      spinner.text = `Checking ${dependencies.size} dependencies...`;

      // Check for updates and vulnerabilities
      spinner.text = 'Fetching latest versions and checking for vulnerabilities...';

      const results = await checkDependencies(dependencies, npmService);

      // Generate report
      spinner.text = 'Generating report...';
      const report = generateReport(results, packageJson, parser);

      spinner.succeed('Dependency check completed!');

      // Output results
      formatOutput(report, options.format);

      // Show cache stats if caching is enabled
      if (options.cache !== false) {
         const cacheStats = npmService.getCacheStats();
         console.log(chalk.gray(`\nCache hits: ${cacheStats.hits}, misses: ${cacheStats.misses}`));
      }
   } catch (error) {
      spinner.fail(`Error during dependency check: ${error.message}`);
      console.error(chalk.red(error.stack));
      process.exit(1);
   }
}

async function checkDependencies(dependencies, npmService) {
   const results = [];
   const packageNames = Array.from(dependencies.keys());

   // Batch fetch latest versions for performance
   const latestVersions = await Promise.allSettled(
      packageNames.map((name) => npmService.getLatestVersion(name))
   );

   // Process each dependency
   for (let i = 0; i < packageNames.length; i++) {
      const packageName = packageNames[i];
      const dependency = dependencies.get(packageName);
      const latestVersionResult = latestVersions[i];

      const result = {
         name: packageName,
         currentVersion: dependency.version,
         latestVersion: null,
         updateAvailable: false,
         updateType: null,
         vulnerabilities: [],
         dependencyType: dependency.type,
         range: dependency.range,
      };

      if (latestVersionResult.status === 'fulfilled' && latestVersionResult.value) {
         result.latestVersion = latestVersionResult.value;
         result.updateAvailable = semver.gt(
            latestVersionResult.value,
            dependency.range.clean || '0.0.0'
         );

         if (result.updateAvailable) {
            result.updateType = getUpdateType(dependency.range.clean, latestVersionResult.value);
         }
      }

      // Check for vulnerabilities (this would integrate with security databases)
      if (dependency.range.clean) {
         result.vulnerabilities = await npmService.getVulnerabilities(
            packageName,
            dependency.range.clean
         );
      }

      results.push(result);
   }

   return results;
}

function getUpdateType(currentVersion, latestVersion) {
   if (!currentVersion || !latestVersion) return 'unknown';

   const current = semver.parse(currentVersion);
   const latest = semver.parse(latestVersion);

   if (!current || !latest) return 'unknown';

   if (latest.major > current.major) return 'major';
   if (latest.minor > current.minor) return 'minor';
   if (latest.patch > current.patch) return 'patch';

   return 'none';
}

function generateReport(results, packageJson, parser) {
   const stats = parser.getDependencyStats(packageJson);

   const report = {
      package: {
         name: packageJson.name,
         version: packageJson.version,
         path: packageJson.path,
      },
      summary: {
         total: results.length,
         upToDate: results.filter((r) => !r.updateAvailable).length,
         outdated: results.filter((r) => r.updateAvailable).length,
         majorUpdates: results.filter((r) => r.updateType === 'major').length,
         minorUpdates: results.filter((r) => r.updateType === 'minor').length,
         patchUpdates: results.filter((r) => r.updateType === 'patch').length,
         vulnerabilities: results.reduce((sum, r) => sum + r.vulnerabilities.length, 0),
      },
      dependencies: results,
      stats: stats,
   };

   return report;
}

module.exports = checkCommand;
