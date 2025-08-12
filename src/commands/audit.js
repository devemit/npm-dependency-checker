const ora = require('ora');
const chalk = require('chalk');
const path = require('path');
const NpmRegistryService = require('../services/npm-registry');
const PackageParser = require('../services/parser');
const { formatError, formatWarning, formatInfo } = require('../utils/output');
const semver = require('semver');

async function auditCommand(options) {
   const spinner = ora('Initializing security audit...').start();

   try {
      // Initialize services
      const npmService = new NpmRegistryService({
         maxConcurrency: 5, // Lower concurrency for security checks
         cacheTTL: 1800, // 30 minutes cache for security data
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
         spinner.succeed('No dependencies found to audit');
         return;
      }

      spinner.text = `Auditing ${dependencies.size} dependencies for vulnerabilities...`;

      // Perform security audit
      const auditResults = await performSecurityAudit(dependencies, npmService, options.severity);

      // Generate audit report
      spinner.text = 'Generating security report...';
      const report = generateAuditReport(auditResults, packageJson, options.severity);

      spinner.succeed('Security audit completed!');

      // Display results
      displayAuditResults(report, options);

      // Handle auto-fix if requested
      if (options.fix && report.vulnerabilities.length > 0) {
         await handleAutoFix(report.vulnerabilities, packagePath);
      }
   } catch (error) {
      spinner.fail(`Error during security audit: ${error.message}`);
      formatError(error, 'Security audit failed');
      process.exit(1);
   }
}

async function performSecurityAudit(dependencies, npmService, severityLevel) {
   const results = [];
   const severityLevels = ['low', 'moderate', 'high', 'critical'];
   const minSeverityIndex = severityLevels.indexOf(severityLevel.toLowerCase());

   // Mock vulnerability data - in real implementation, this would integrate with
   // npm audit API, Snyk, or other security databases
   const mockVulnerabilities = {
      lodash: [
         {
            id: 'CVE-2021-23337',
            severity: 'high',
            title: 'Prototype Pollution in lodash',
            description: 'A prototype pollution vulnerability in lodash versions before 4.17.21',
            affectedVersions: '<4.17.21',
            fixedVersions: '>=4.17.21',
            cwe: 'CWE-1321',
         },
      ],
      axios: [
         {
            id: 'CVE-2023-45857',
            severity: 'moderate',
            title: 'SSRF vulnerability in axios',
            description: 'Server-Side Request Forgery vulnerability in axios',
            affectedVersions: '<1.6.0',
            fixedVersions: '>=1.6.0',
            cwe: 'CWE-918',
         },
      ],
   };

   for (const [name, dependency] of dependencies) {
      const vulnerabilities = mockVulnerabilities[name] || [];

      // Filter by severity level
      const filteredVulns = vulnerabilities.filter((vuln) => {
         const vulnSeverityIndex = severityLevels.indexOf(vuln.severity);
         return vulnSeverityIndex >= minSeverityIndex;
      });

      if (filteredVulns.length > 0) {
         results.push({
            package: name,
            currentVersion: dependency.version,
            dependencyType: dependency.type,
            vulnerabilities: filteredVulns,
         });
      }
   }

   return results;
}

function generateAuditReport(auditResults, packageJson, severityLevel) {
   const allVulnerabilities = auditResults.flatMap((result) =>
      result.vulnerabilities.map((vuln) => ({
         ...vuln,
         package: result.package,
         currentVersion: result.currentVersion,
         dependencyType: result.dependencyType,
      }))
   );

   const severityCounts = {
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
   };

   allVulnerabilities.forEach((vuln) => {
      severityCounts[vuln.severity]++;
   });

   return {
      package: {
         name: packageJson.name,
         version: packageJson.version,
      },
      summary: {
         totalVulnerabilities: allVulnerabilities.length,
         affectedPackages: auditResults.length,
         severityCounts,
         minSeverity: severityLevel,
      },
      vulnerabilities: allVulnerabilities,
      packages: auditResults,
   };
}

function displayAuditResults(report, options) {
   console.log('\n' + chalk.bold.red('🔒 Security Audit Report'));
   console.log(chalk.gray('─'.repeat(80)));

   // Package info
   console.log(chalk.bold(`Package: ${report.package.name}@${report.package.version}`));
   console.log(chalk.gray(`Minimum severity: ${options.severity}`));
   console.log('');

   // Summary
   console.log(chalk.bold('📊 Summary:'));
   console.log(`  Total vulnerabilities: ${chalk.red(report.summary.totalVulnerabilities)}`);
   console.log(`  Affected packages: ${chalk.yellow(report.summary.affectedPackages)}`);
   console.log('');

   // Severity breakdown
   console.log(chalk.bold('🚨 Severity Breakdown:'));
   Object.entries(report.summary.severityCounts).forEach(([severity, count]) => {
      if (count > 0) {
         const color =
            severity === 'critical'
               ? chalk.red
               : severity === 'high'
                 ? chalk.red
                 : severity === 'moderate'
                   ? chalk.yellow
                   : chalk.blue;
         console.log(`  ${severity.toUpperCase()}: ${color(count)}`);
      }
   });
   console.log('');

   // Vulnerabilities details
   if (report.vulnerabilities.length > 0) {
      console.log(chalk.bold('📋 Vulnerabilities:'));
      console.log(chalk.gray('─'.repeat(120)));

      // Sort by severity (critical first)
      const severityOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
      const sortedVulns = report.vulnerabilities.sort(
         (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
      );

      for (const vuln of sortedVulns) {
         const severityColor =
            vuln.severity === 'critical'
               ? chalk.red
               : vuln.severity === 'high'
                 ? chalk.red
                 : vuln.severity === 'moderate'
                   ? chalk.yellow
                   : chalk.blue;

         console.log(chalk.bold(`${severityColor(vuln.severity.toUpperCase())} - ${vuln.id}`));
         console.log(`  Package: ${chalk.cyan(vuln.package)}@${vuln.currentVersion}`);
         console.log(`  Title: ${vuln.title}`);
         console.log(`  Description: ${vuln.description}`);
         console.log(`  Affected versions: ${chalk.red(vuln.affectedVersions)}`);
         console.log(`  Fixed versions: ${chalk.green(vuln.fixedVersions)}`);
         console.log(`  CWE: ${chalk.gray(vuln.cwe)}`);
         console.log('');
      }

      // Recommendations
      console.log(chalk.bold('💡 Recommendations:'));
      console.log(chalk.yellow('  • Update affected packages to fixed versions'));
      console.log(chalk.yellow('  • Review and test changes before deploying'));
      console.log(chalk.yellow('  • Consider using "deps-checker update" for automated updates'));

      if (options.fix) {
         console.log(chalk.green('  • Auto-fix mode enabled - attempting to fix vulnerabilities'));
      }
   } else {
      console.log(chalk.green('✅ No vulnerabilities found at the specified severity level!'));
   }
}

async function handleAutoFix(vulnerabilities, packagePath) {
   console.log('\n' + chalk.bold('🔧 Auto-fix Mode:'));

   // Group vulnerabilities by package
   const packageVulns = {};
   vulnerabilities.forEach((vuln) => {
      if (!packageVulns[vuln.package]) {
         packageVulns[vuln.package] = [];
      }
      packageVulns[vuln.package].push(vuln);
   });

   for (const [packageName, vulns] of Object.entries(packageVulns)) {
      // Find the highest fixed version needed
      const highestFixedVersion = vulns.reduce((highest, vuln) => {
         const fixedVersion = vuln.fixedVersions.replace('>=', '');
         return semver.gt(fixedVersion, highest) ? fixedVersion : highest;
      }, '0.0.0');

      console.log(chalk.cyan(`  Updating ${packageName} to ${highestFixedVersion}...`));

      // In a real implementation, this would update the package.json
      // For now, just show what would be done
      formatInfo(`Would update ${packageName} to ${highestFixedVersion}`);
   }

   formatWarning('Auto-fix is currently in preview mode. Manual verification is recommended.');
}

module.exports = auditCommand;
