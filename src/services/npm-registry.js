const axios = require('axios');
const pLimit = require('p-limit');
const NodeCache = require('node-cache');
const chalk = require('chalk');

class NpmRegistryService {
   constructor(options = {}) {
      this.baseURL = 'https://registry.npmjs.org';
      this.cache = new NodeCache({
         stdTTL: options.cacheTTL || 3600, // 1 hour default
         checkperiod: 600,
      });
      this.limit = pLimit(options.maxConcurrency || 10);

      // Create axios instance with connection pooling
      this.client = axios.create({
         baseURL: this.baseURL,
         timeout: options.timeout || 10000,
         headers: {
            'User-Agent': 'cli-deps-checker/1.0.0',
            Accept: 'application/json',
         },
         // Connection pooling
         httpAgent: new (require('http').Agent)({
            keepAlive: true,
            maxSockets: options.maxSockets || 50,
            maxFreeSockets: 10,
            timeout: 60000,
         }),
         httpsAgent: new (require('https').Agent)({
            keepAlive: true,
            maxSockets: options.maxSockets || 50,
            maxFreeSockets: 10,
            timeout: 60000,
         }),
      });
   }

   /**
    * Get package information with caching
    */
   async getPackageInfo(packageName) {
      const cacheKey = `package:${packageName}`;

      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached) {
         return cached;
      }

      try {
         const response = await this.client.get(`/${packageName}`);
         const packageInfo = response.data;

         // Cache the result
         this.cache.set(cacheKey, packageInfo);

         return packageInfo;
      } catch (error) {
         if (error.response?.status === 404) {
            throw new Error(`Package '${packageName}' not found`);
         }
         throw new Error(`Failed to fetch package '${packageName}': ${error.message}`);
      }
   }

   /**
    * Get latest version of a package
    */
   async getLatestVersion(packageName) {
      const packageInfo = await this.getPackageInfo(packageName);
      return packageInfo['dist-tags']?.latest || null;
   }

   /**
    * Get all versions of a package
    */
   async getVersions(packageName) {
      const packageInfo = await this.getPackageInfo(packageName);
      return Object.keys(packageInfo.versions || {});
   }

   /**
    * Get security vulnerabilities for a package
    */
   async getVulnerabilities(packageName, version) {
      const cacheKey = `vuln:${packageName}:${version}`;

      const cached = this.cache.get(cacheKey);
      if (cached) {
         return cached;
      }

      try {
         // This would integrate with npm audit API or security databases
         // For now, returning mock data structure
         const vulnerabilities = [];

         this.cache.set(cacheKey, vulnerabilities);
         return vulnerabilities;
      } catch (error) {
         console.warn(
            chalk.yellow(`Warning: Could not fetch vulnerabilities for ${packageName}@${version}`)
         );
         return [];
      }
   }

   /**
    * Get cache statistics
    */
   getCacheStats() {
      return this.cache.getStats();
   }
}

module.exports = NpmRegistryService;
