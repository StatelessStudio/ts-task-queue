/**
 * This file boots the worker in dev when the project is run through ts-node.
 *  - This file is not included in the build.
 */
if (!process.execArgv.includes('ts-node/register')) {
    require('ts-node').register();
}

const path = require('path');
require(path.resolve(__dirname, './index.ts'));
