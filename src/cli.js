#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const checkCommand = require('./commands/check');
const auditCommand = require('./commands/audit');
const updateCommand = require('./commands/update');

const program = new Command();

// Set up the CLI
program
   .name('deps-checker')
   .description('A high-performance CLI tool for checking npm dependencies')
   .version('1.0.0');

// Add commands
program
   .command('check')
   .description('Check dependencies for updates and vulnerabilities')
   .option('-p, --path <path>', 'Path to package.json file', './package.json')
   .option('-d, --depth <number>', 'Depth of dependency tree to check', '1')
   .option('--no-cache', 'Disable caching for fresh results')
   .option('--parallel <number>', 'Number of parallel requests', '10')
   .option('--format <format>', 'Output format (table, json, csv)', 'table')
   .action(checkCommand);

program
   .command('audit')
   .description('Security audit of dependencies')
   .option('-p, --path <path>', 'Path to package.json file', './package.json')
   .option(
      '--severity <level>',
      'Minimum severity level (low, moderate, high, critical)',
      'moderate'
   )
   .option('--fix', 'Automatically fix vulnerabilities where possible')
   .action(auditCommand);

program
   .command('update')
   .description('Get update recommendations for dependencies')
   .option('-p, --path <path>', 'Path to package.json file', './package.json')
   .option('--major', 'Include major version updates')
   .option('--dry-run', 'Show what would be updated without making changes')
   .action(updateCommand);

// Global error handler
program.exitOverride();

try {
   program.parse();
} catch (err) {
   if (err.code === 'commander.help') {
      process.exit(0);
   }
   console.error(chalk.red('Error:'), err.message);
   process.exit(1);
}
