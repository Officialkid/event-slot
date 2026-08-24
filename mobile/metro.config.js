const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");
const sharedLibRoot = path.resolve(workspaceRoot, "lib");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [sharedLibRoot];
// Use a single in-process worker so local preview survives restricted shells
// where Metro child-process spawning is denied.
config.maxWorkers = 1;
config.stickyWorkers = false;
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
