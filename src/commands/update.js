const ora = require('ora');
const chalk = require('chalk');
const path = require('path');
const semver = require('semver');
const NpmRegistryService = require('../services/npm-registry');
const PackageParser = require('../services/parser');
const { formatError, formatWarning, formatInfo } = require('../utils/output');

async function updateCommand(options) {
   const spinner = ora('Initializing update check...').start();

   try {
      // Initialize services
      const npmService = new NpmRegistryService({
         maxConcurrency: 10,
         cacheTTL: 3600,
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
         spinner.succeed('No dependencies found to check for updates');
         return;
      }

      spinner.text = `Checking ${dependencies.size} dependencies for updates...`;

      // Get update recommendations
      const updateResults = await getUpdateRecommendations(dependencies, npmService, options);

      // Generate update report
      spinner.text = 'Generating update recommendations...';
      const report = generateUpdateReport(updateResults, packageJson, options);

      spinner.succeed('Update check completed!');

      // Display results
      displayUpdateResults(report, options);

      // Handle dry-run updates
      if (options.dryRun && report.recommendations.length > 0) {
         await handleDryRun(report.recommendations, packagePath);
      }
   } catch (error) {
      spinner.fail(`Error during update check: ${error.message}`);
      formatError(error, 'Update check failed');
      process.exit(1);
   }
}

async function getUpdateRecommendations(dependencies, npmService, options) {
   const results = [];
   const packageNames = Array.from(dependencies.keys());

   // Batch fetch latest versions and all versions for analysis
   const [latestVersions, allVersions] = await Promise.all([
      Promise.allSettled(packageNames.map((name) => npmService.getLatestVersion(name))),
      Promise.allSettled(packageNames.map((name) => npmService.getVersions(name))),
   ]);

   for (let i = 0; i < packageNames.length; i++) {
      const packageName = packageNames[i];
      const dependency = dependencies.get(packageName);
      const latestVersionResult = latestVersions[i];
      const allVersionsResult = allVersions[i];

      const result = {
         name: packageName,
         currentVersion: dependency.version,
         currentRange: dependency.range,
         dependencyType: dependency.type,
         latestVersion: null,
         availableUpdates: [],
         recommendations: [],
      };

      if (latestVersionResult.status === 'fulfilled' && latestVersionResult.value) {
         result.latestVersion = latestVersionResult.value;

         // Analyze available updates
         if (allVersionsResult.status === 'fulfilled' && allVersionsResult.value) {
            result.availableUpdates = analyzeAvailableUpdates(
               dependency.range,
               allVersionsResult.value,
               options.major
            );
         }

         // Generate recommendations
         result.recommendations = generateRecommendations(
            dependency,
            result.availableUpdates,
            options
         );
      }

      results.push(result);
   }

   return results;
}

function analyzeAvailableUpdates(currentRange, allVersions, includeMajor) {
   const updates = [];
   const currentVersion = currentRange.clean;

   if (!currentVersion) return updates;

   // Sort versions in descending order
   const sortedVersions = allVersions
      .filter((version) => semver.valid(version))
      .sort((a, b) => semver.compare(b, a));

   for (const version of sortedVersions) {
      // Skip if not newer than current
      if (!semver.gt(version, currentVersion)) continue;

      const updateType = getUpdateType(currentVersion, version);

      // Skip major updates if not requested
      if (updateType === 'major' && !includeMajor) continue;

      updates.push({
         version,
         type: updateType,
         breaking: updateType === 'major',
         semver: semver.parse(version),
      });
   }

   return updates;
}

function generateRecommendations(dependency, availableUpdates, options) {
   const recommendations = [];

   if (availableUpdates.length === 0) {
      return recommendations;
   }

   // Group updates by type
   const updatesByType = {
      patch: availableUpdates.filter((u) => u.type === 'patch'),
      minor: availableUpdates.filter((u) => u.type === 'minor'),
      major: availableUpdates.filter((u) => u.type === 'major'),
   };

   // Recommend latest patch update
   if (updatesByType.patch.length > 0) {
      const latestPatch = updatesByType.patch[0];
      recommendations.push({
         type: 'patch',
         version: latestPatch.version,
         priority: 'high',
         reason: 'Safe bug fixes and improvements',
         breaking: false,
      });
   }

   // Recommend latest minor update
   if (updatesByType.minor.length > 0) {
      const latestMinor = updatesByType.minor[0];
      recommendations.push({
         type: 'minor',
         version: latestMinor.version,
         priority: 'medium',
         reason: 'New features and improvements',
         breaking: false,
      });
   }

   // Recommend major update if requested
   if (options.major && updatesByType.major.length > 0) {
      const latestMajor = updatesByType.major[0];
      recommendations.push({
         type: 'major',
         version: latestMajor.version,
         priority: 'low',
         reason: 'Major version with potential breaking changes',
         breaking: true,
      });
   }

   return recommendations;
}

function generateUpdateReport(updateResults, packageJson, options) {
   const allRecommendations = updateResults.flatMap((result) =>
      result.recommendations.map((rec) => ({
         ...rec,
         package: result.name,
         currentVersion: result.currentVersion,
         dependencyType: result.dependencyType,
      }))
   );

   const summary = {
      total: updateResults.length,
      upToDate: updateResults.filter((r) => r.recommendations.length === 0).length,
      hasUpdates: updateResults.filter((r) => r.recommendations.length > 0).length,
      patchUpdates: allRecommendations.filter((r) => r.type === 'patch').length,
      minorUpdates: allRecommendations.filter((r) => r.type === 'minor').length,
      majorUpdates: allRecommendations.filter((r) => r.type === 'major').length,
   };

   return {
      package: {
         name: packageJson.name,
         version: packageJson.version,
      },
      summary,
      recommendations: allRecommendations,
      packages: updateResults,
      options,
   };
}

function displayUpdateResults(report, options) {
   console.log('\n' + chalk.bold.blue('🔄 Update Recommendations'));
   console.log(chalk.gray('─'.repeat(80)));

   // Package info
   console.log(chalk.bold(`Package: ${report.package.name}@${report.package.version}`));
   if (options.major) {
      console.log(chalk.yellow('  Including major version updates'));
   }
   console.log('');

   // Summary
   console.log(chalk.bold('📊 Summary:'));
   console.log(`  Total dependencies: ${chalk.cyan(report.summary.total)}`);
   console.log(`  Up to date: ${chalk.green(report.summary.upToDate)}`);
   console.log(`  Has updates: ${chalk.yellow(report.summary.hasUpdates)}`);
   console.log('');

   if (report.summary.hasUpdates > 0) {
      console.log(chalk.bold('📋 Update Breakdown:'));
      console.log(`  Patch updates: ${chalk.blue(report.summary.patchUpdates)}`);
      console.log(`  Minor updates: ${chalk.yellow(report.summary.minorUpdates)}`);
      console.log(`  Major updates: ${chalk.red(report.summary.majorUpdates)}`);
      console.log('');

      // Group recommendations by type
      const recommendationsByType = {
         patch: report.recommendations.filter((r) => r.type === 'patch'),
         minor: report.recommendations.filter((r) => r.type === 'minor'),
         major: report.recommendations.filter((r) => r.type === 'major'),
      };

      // Display recommendations
      displayRecommendationsByType('Patch Updates', recommendationsByType.patch, chalk.blue);
      displayRecommendationsByType('Minor Updates', recommendationsByType.minor, chalk.yellow);
      displayRecommendationsByType('Major Updates', recommendationsByType.major, chalk.red);

      // Update commands
      console.log(chalk.bold('💡 Update Commands:'));
      console.log(chalk.gray('  # Update all patch versions (safest)'));
      console.log(chalk.cyan('  npm update'));
      console.log('');
      console.log(chalk.gray('  # Update specific packages'));
      recommendationsByType.patch.slice(0, 3).forEach((rec) => {
         console.log(chalk.cyan(`  npm install ${rec.package}@${rec.version}`));
      });

      if (recommendationsByType.minor.length > 0) {
         console.log('');
         console.log(chalk.gray('  # Update minor versions (review changes)'));
         recommendationsByType.minor.slice(0, 3).forEach((rec) => {
            console.log(chalk.yellow(`  npm install ${rec.package}@${rec.version}`));
         });
      }

      if (recommendationsByType.major.length > 0) {
         console.log('');
         console.log(chalk.gray('  # Update major versions (breaking changes)'));
         recommendationsByType.major.slice(0, 3).forEach((rec) => {
            console.log(chalk.red(`  npm install ${rec.package}@${rec.version}`));
         });
      }
   } else {
      console.log(chalk.green('✅ All dependencies are up to date!'));
   }
}

function displayRecommendationsByType(title, recommendations, color) {
   if (recommendations.length === 0) return;

   console.log(chalk.bold(color(title)) + ` (${recommendations.length})`);
   console.log(chalk.gray('─'.repeat(60)));

   for (const rec of recommendations) {
      const priorityIcon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';

      console.log(`${priorityIcon} ${chalk.cyan(rec.package)}`);
      console.log(`   Current: ${rec.currentVersion} → Latest: ${color(rec.version)}`);
      console.log(`   Reason: ${rec.reason}`);
      if (rec.breaking) {
         console.log(`   ${chalk.red('⚠️  Breaking changes possible')}`);
      }
      console.log('');
   }
}

async function handleDryRun(recommendations, packagePath) {
   console.log('\n' + chalk.bold('🔍 Dry Run Mode:'));
   console.log(chalk.gray('The following updates would be applied:'));
   console.log('');

   // Group by update type
   const updatesByType = {
      patch: recommendations.filter((r) => r.type === 'patch'),
      minor: recommendations.filter((r) => r.type === 'minor'),
      major: recommendations.filter((r) => r.type === 'major'),
   };

   for (const [type, updates] of Object.entries(updatesByType)) {
      if (updates.length === 0) continue;

      const color = type === 'patch' ? chalk.blue : type === 'minor' ? chalk.yellow : chalk.red;

      console.log(color(`${type.toUpperCase()} Updates:`));
      for (const update of updates) {
         console.log(`  ${update.package}: ${update.currentVersion} → ${update.version}`);
      }
      console.log('');
   }

   formatInfo('Dry run completed. No changes were made to package.json');
   formatWarning('Run without --dry-run to apply these updates');
}

function getUpdateType(currentVersion, newVersion) {
   if (!currentVersion || !newVersion) return 'unknown';

   const current = semver.parse(currentVersion);
   const latest = semver.parse(newVersion);

   if (!current || !latest) return 'unknown';

   if (latest.major > current.major) return 'major';
   if (latest.minor > current.minor) return 'minor';
   if (latest.patch > current.patch) return 'patch';

   return 'none';
}

module.exports = updateCommand;
