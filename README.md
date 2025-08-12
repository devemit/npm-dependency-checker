# cli-deps-checker

A high-performance CLI tool for checking npm dependencies, security vulnerabilities, and update recommendations.

## 🚀 Features

- **High Performance**: Parallel processing, intelligent caching, and connection pooling
- **Comprehensive Analysis**: Check dependencies, security vulnerabilities, and update recommendations
- **Multiple Output Formats**: Table, JSON, and CSV output formats
- **Security Auditing**: Built-in security vulnerability scanning
- **Update Recommendations**: Smart update suggestions with breaking change warnings
- **Flexible Configuration**: Customizable depth, concurrency, and filtering options

## 📦 Installation

```bash
# Install globally
npm install -g cli-deps-checker

# Or use npx
npx cli-deps-checker

# Or install locally
npm install cli-deps-checker
```

## 🎯 Quick Start

```bash
# Check dependencies in current directory
deps-checker check

# Check with custom options
deps-checker check --path ./package.json --depth 2 --parallel 20

# Security audit
deps-checker audit --severity moderate

# Get update recommendations
deps-checker update --major --dry-run
```

## 📋 Commands

### Check Dependencies

```bash
deps-checker check [options]
```

**Options:**

- `-p, --path <path>` - Path to package.json file (default: ./package.json)
- `-d, --depth <number>` - Depth of dependency tree to check (default: 1)
- `--no-cache` - Disable caching for fresh results
- `--parallel <number>` - Number of parallel requests (default: 10)
- `--format <format>` - Output format: table, json, csv (default: table)

**Examples:**

```bash
# Basic check
deps-checker check

# Deep dependency analysis
deps-checker check --depth 3 --parallel 20

# JSON output for CI/CD
deps-checker check --format json

# Check specific package.json
deps-checker check --path ./frontend/package.json
```

### Security Audit

```bash
deps-checker audit [options]
```

**Options:**

- `-p, --path <path>` - Path to package.json file (default: ./package.json)
- `--severity <level>` - Minimum severity level: low, moderate, high, critical (default: moderate)
- `--fix` - Automatically fix vulnerabilities where possible

**Examples:**

```bash
# Basic security audit
deps-checker audit

# High severity only
deps-checker audit --severity high

# Auto-fix vulnerabilities
deps-checker audit --fix
```

### Update Recommendations

```bash
deps-checker update [options]
```

**Options:**

- `-p, --path <path>` - Path to package.json file (default: ./package.json)
- `--major` - Include major version updates
- `--dry-run` - Show what would be updated without making changes

**Examples:**

```bash
# Get update recommendations
deps-checker update

# Include major updates
deps-checker update --major

# Preview changes
deps-checker update --dry-run
```

## ⚡ Performance Features

### Parallel Processing

- Configurable concurrency limits for API requests
- Batch processing of dependency checks
- Efficient dependency tree traversal

### Intelligent Caching

- In-memory caching with configurable TTL
- Cache statistics and hit/miss ratios
- Cache bypass option for fresh results

### Connection Pooling

- HTTP/HTTPS connection reuse
- Configurable socket limits
- Keep-alive connections for better performance

### Memory Optimization

- Streaming file processing for large package.json files
- Efficient data structures for dependency trees
- Garbage collection friendly code patterns

## 📊 Output Formats

### Table Format (Default)

```
📦 Dependency Check Report
────────────────────────────────────────────────────────────────────────────────
Package: my-app@1.0.0
Path: /path/to/package.json

📊 Summary:
  Total dependencies: 15
  Up to date: 12
  Outdated: 3
  Major updates: 1
  Minor updates: 1
  Patch updates: 1
  Vulnerabilities: 0

📋 Dependencies:
────────────────────────────────────────────────────────────────────────────────
Package                    Current         Latest          Update     Type            Vulns   Status
────────────────────────────────────────────────────────────────────────────────
lodash                     4.17.20         4.17.21         patch      dependencies    0       🔧
axios                      1.5.0           1.6.0           minor      dependencies    0       🔄
react                      17.0.2          18.2.0          major      dependencies    0       ⚠️
```

### JSON Format

```json
{
  "package": {
    "name": "my-app",
    "version": "1.0.0"
  },
  "summary": {
    "total": 15,
    "upToDate": 12,
    "outdated": 3,
    "majorUpdates": 1,
    "minorUpdates": 1,
    "patchUpdates": 1,
    "vulnerabilities": 0
  },
  "dependencies": [...]
}
```

### CSV Format

```csv
Package,Current Version,Latest Version,Update Type,Dependency Type,Vulnerabilities,Update Available
lodash,4.17.20,4.17.21,patch,dependencies,0,true
axios,1.5.0,1.6.0,minor,dependencies,0,true
```

## 🔧 Configuration

### Environment Variables

- `DEBUG` - Enable debug logging
- `NPM_REGISTRY` - Custom npm registry URL
- `CACHE_TTL` - Cache time-to-live in seconds

### Performance Tuning

```bash
# High concurrency for large projects
deps-checker check --parallel 50

# Disable cache for fresh results
deps-checker check --no-cache

# Shallow dependency tree for speed
deps-checker check --depth 1
```

## 🛠️ Development

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0

### Setup

```bash
# Clone repository
git clone https://github.com/devemit/npm-dependency-checker.git
cd npm-dependency-checker

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

### Project Structure

```
npm-dependency-checker/
├── src/
│   ├── cli.js              # Main CLI entry point
│   ├── commands/
│   │   ├── check.js        # Dependency check logic
│   │   ├── audit.js        # Security audit
│   │   └── update.js       # Update recommendations
│   ├── services/
│   │   ├── npm-registry.js # npm registry API client
│   │   ├── cache.js        # Caching layer
│   │   └── parser.js       # Package.json parser
│   └── utils/
│       └── output.js       # Output formatting
├── tests/
├── package.json
└── README.md
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 🙏 Acknowledgments

- Built with [Commander.js](https://github.com/tj/commander.js) for CLI framework
- Styled with [Chalk](https://github.com/chalk/chalk) for terminal colors
- Powered by [npm-registry-fetch](https://github.com/npm/npm-registry-fetch) for registry access
- Version parsing with [semver](https://github.com/npm/node-semver)
