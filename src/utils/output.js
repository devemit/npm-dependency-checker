const chalk = require('chalk');

/**
 * Format output based on specified format
 */
function formatOutput(report, format = 'table') {
   switch (format.toLowerCase()) {
      case 'json':
         formatJson(report);
         break;
      case 'csv':
         formatCsv(report);
         break;
      case 'table':
      default:
         formatTable(report);
         break;
   }
}

/**
 * Format output as a table
 */
function formatTable(report) {
   console.log('\n' + chalk.bold.blue('📦 Dependency Check Report'));
   console.log(chalk.gray('─'.repeat(80)));

   // Package info
   console.log(chalk.bold(`Package: ${report.package.name}@${report.package.version}`));
   console.log(chalk.gray(`Path: ${report.package.path}`));
   console.log('');

   // Summary
   console.log(chalk.bold('📊 Summary:'));
   console.log(`  Total dependencies: ${chalk.cyan(report.summary.total)}`);
   console.log(`  Up to date: ${chalk.green(report.summary.upToDate)}`);
   console.log(`  Outdated: ${chalk.yellow(report.summary.outdated)}`);
   console.log(`  Major updates: ${chalk.red(report.summary.majorUpdates)}`);
   console.log(`  Minor updates: ${chalk.yellow(report.summary.minorUpdates)}`);
   console.log(`  Patch updates: ${chalk.blue(report.summary.patchUpdates)}`);
   console.log(`  Vulnerabilities: ${chalk.red(report.summary.vulnerabilities)}`);
   console.log('');

   // Dependencies table
   if (report.dependencies.length > 0) {
      console.log(chalk.bold('📋 Dependencies:'));
      console.log(chalk.gray('─'.repeat(120)));

      // Table header
      console.log(
         chalk.bold(
            padRight('Package', 25) +
               padRight('Current', 15) +
               padRight('Latest', 15) +
               padRight('Update', 10) +
               padRight('Type', 15) +
               padRight('Vulns', 8) +
               'Status'
         )
      );
      console.log(chalk.gray('─'.repeat(120)));

      // Sort dependencies: outdated first, then by name
      const sortedDeps = report.dependencies.sort((a, b) => {
         if (a.updateAvailable !== b.updateAvailable) {
            return b.updateAvailable ? 1 : -1;
         }
         return a.name.localeCompare(b.name);
      });

      // Table rows
      for (const dep of sortedDeps) {
         const status = getStatusIcon(dep);
         const updateType = getUpdateTypeDisplay(dep.updateType);
         const vulns = dep.vulnerabilities.length > 0 ? chalk.red(dep.vulnerabilities.length) : '0';

         console.log(
            padRight(chalk.cyan(dep.name), 25) +
               padRight(dep.currentVersion, 15) +
               padRight(dep.latestVersion || 'N/A', 15) +
               padRight(updateType, 10) +
               padRight(dep.dependencyType, 15) +
               padRight(vulns, 8) +
               status
         );
      }

      console.log(chalk.gray('─'.repeat(120)));
   }

   // Recommendations
   if (report.summary.outdated > 0) {
      console.log('\n' + chalk.bold('💡 Recommendations:'));

      const majorUpdates = report.dependencies.filter((d) => d.updateType === 'major');
      const minorUpdates = report.dependencies.filter((d) => d.updateType === 'minor');
      const patchUpdates = report.dependencies.filter((d) => d.updateType === 'patch');

      if (majorUpdates.length > 0) {
         console.log(
            chalk.red(
               `  ⚠️  ${majorUpdates.length} major updates available. Review carefully before updating.`
            )
         );
      }

      if (minorUpdates.length > 0) {
         console.log(
            chalk.yellow(
               `  🔄 ${minorUpdates.length} minor updates available. Consider updating for new features.`
            )
         );
      }

      if (patchUpdates.length > 0) {
         console.log(
            chalk.blue(
               `  🔧 ${patchUpdates.length} patch updates available. Safe to update for bug fixes.`
            )
         );
      }

      console.log(
         chalk.gray('  Run "npm-dependency-check update" for detailed update recommendations.')
      );
   }

   if (report.summary.vulnerabilities > 0) {
      console.log(chalk.red(`\n🚨 ${report.summary.vulnerabilities} vulnerabilities found!`));
      console.log(chalk.gray('  Run "npm-dependency-check audit" for security details.'));
   }
}

/**
 * Format output as JSON
 */
function formatJson(report) {
   console.log(JSON.stringify(report, null, 2));
}

/**
 * Format output as CSV
 */
function formatCsv(report) {
   // CSV header
   console.log(
      'Package,Current Version,Latest Version,Update Type,Dependency Type,Vulnerabilities,Update Available'
   );

   // CSV rows
   for (const dep of report.dependencies) {
      const row = [
         dep.name,
         dep.currentVersion,
         dep.latestVersion || 'N/A',
         dep.updateType || 'none',
         dep.dependencyType,
         dep.vulnerabilities.length,
         dep.updateAvailable ? 'true' : 'false',
      ]
         .map((field) => `"${field}"`)
         .join(',');

      console.log(row);
   }
}

/**
 * Get status icon for dependency
 */
function getStatusIcon(dep) {
   if (dep.vulnerabilities.length > 0) {
      return chalk.red('🚨');
   }

   if (dep.updateAvailable) {
      switch (dep.updateType) {
         case 'major':
            return chalk.red('⚠️');
         case 'minor':
            return chalk.yellow('🔄');
         case 'patch':
            return chalk.blue('🔧');
         default:
            return chalk.gray('❓');
      }
   }

   return chalk.green('✅');
}

/**
 * Get update type display
 */
function getUpdateTypeDisplay(updateType) {
   if (!updateType || updateType === 'none') return 'none';

   const colors = {
      major: chalk.red,
      minor: chalk.yellow,
      patch: chalk.blue,
   };

   return colors[updateType] ? colors[updateType](updateType) : updateType;
}

/**
 * Pad string to right with spaces
 */
function padRight(str, length) {
   return String(str).padEnd(length);
}

/**
 * Format error output
 */
function formatError(error, context = '') {
   console.error(chalk.red('❌ Error:'), error.message);
   if (context) {
      console.error(chalk.gray(`Context: ${context}`));
   }
   if (process.env.DEBUG) {
      console.error(chalk.gray(error.stack));
   }
}

/**
 * Format warning output
 */
function formatWarning(message) {
   console.warn(chalk.yellow('⚠️  Warning:'), message);
}

/**
 * Format info output
 */
function formatInfo(message) {
   console.log(chalk.blue('ℹ️  '), message);
}

module.exports = {
   formatOutput,
   formatError,
   formatWarning,
   formatInfo,
};
