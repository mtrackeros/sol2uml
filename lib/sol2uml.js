#! /usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const path_1 = require("path");
const converterClasses2Dot_1 = require("./converterClasses2Dot");
const converterClasses2Storage_1 = require("./converterClasses2Storage");
const converterStorage2Dot_1 = require("./converterStorage2Dot");
const diffContracts_1 = require("./diffContracts");
const filterClasses_1 = require("./filterClasses");
const parserEtherscan_1 = require("./parserEtherscan");
const parserGeneral_1 = require("./parserGeneral");
const squashClasses_1 = require("./squashClasses");
const slotValues_1 = require("./slotValues");
const regEx_1 = require("./utils/regEx");
const validators_1 = require("./utils/validators");
const writerFiles_1 = require("./writerFiles");
const block_1 = require("./utils/block");
const clc = require('cli-color');
const program = new commander_1.Command();
const debugControl = require('debug');
const debug = require('debug')('sol2uml');
program
    .usage('[command] <options>')
    .description(`Generate UML class or storage diagrams from local Solidity code or verified Solidity code on Etherscan-like explorers.
Can also flatten or compare verified source files on Etherscan-like explorers.`)
    .addOption(new commander_1.Option('-sf, --subfolders <value>', 'number of subfolders that will be recursively searched for Solidity files.').default('-1', 'all'))
    .addOption(new commander_1.Option('-f, --outputFormat <value>', 'output file format.')
    .choices(['svg', 'png', 'dot', 'all'])
    .default('svg'))
    .option('-o, --outputFileName <value>', 'output file name')
    .option('-i, --ignoreFilesOrFolders <names>', 'comma-separated list of files or folders to ignore', validators_1.validateNames)
    .addOption(new commander_1.Option('-n, --network <network>', 'Name or chain id of the blockchain explorer. A name like `ethereum` or `base` will map to a chain id, eg 1 or 8453. Alternatively, use an integer of the chain id. Supported names: ' +
    parserEtherscan_1.networks.join(', '))
    .default('ethereum')
    .env('ETH_NETWORK'))
    .addOption(new commander_1.Option('-e, --explorerUrl <url>', 'Override the `network` option with a custom blockchain explorer API URL. eg Polygon Mumbai testnet https://api-testnet.polygonscan.com/api').env('EXPLORER_URL'))
    .addOption(new commander_1.Option('-k, --apiKey <key>', 'Blockchain explorer API key.').env('SCAN_API_KEY'))
    .option('-bc, --backColor <color>', 'Canvas background color. "none" will use a transparent canvas.', 'white')
    .option('-sc, --shapeColor <color>', 'Basic drawing color for graphics, not text', 'black')
    .option('-fc, --fillColor <color>', 'Color used to fill the background of a node', 'gray95')
    .option('-tc, --textColor <color>', 'Color used for text', 'black')
    .option('-v, --verbose', 'run with debugging statements', false);
const version = (0, path_1.basename)(__dirname) === 'lib'
    ? require('../package.json').version // used when run from compile js in /lib
    : require('../../package.json').version; // used when run from TypeScript source files under src/ts via ts-node
program.version(version);
const argumentText = `file name, folder(s) or contract address.
\t\t\t\t  When a folder is used, all *.sol files in that folder and all sub folders are used.
\t\t\t\t  A comma-separated list of files and folders can also be used. For example,
\t\t\t\t\tsol2uml contracts,node_modules/@openzeppelin
\t\t\t\t  If an Ethereum address with a 0x prefix is passed, the verified source code from Etherscan will be used. For example
\t\t\t\t\tsol2uml 0x79fEbF6B9F76853EDBcBc913e6aAE8232cFB9De9`;
program
    .command('class', { isDefault: true })
    .usage('[options] <fileFolderAddress>')
    .description('Generates a UML class diagram from Solidity source code.')
    .argument('fileFolderAddress', argumentText)
    .option('-b, --baseContractNames <names>', 'only output contracts connected to these comma-separated base contract names', validators_1.validateNames)
    .addOption(new commander_1.Option('-d, --depth <value>', 'depth of connected classes to the base contracts. 1 will only show directly connected contracts, interfaces, libraries, structs and enums.').default('100', 'all'))
    .option('-c, --clusterFolders', 'cluster contracts into source folders', false)
    .option('-hv, --hideVariables', 'hide variables from contracts, interfaces, structs and enums', false)
    .option('-hf, --hideFunctions', 'hide functions from contracts, interfaces and libraries', false)
    .option('-hp, --hidePrivates', 'hide private and internal attributes and operators', false)
    .option('-hm, --hideModifiers', 'hide modifier functions from contracts', false)
    .option('-ht, --hideEvents', 'hide events from contracts, interfaces and libraries', false)
    .option('-hc, --hideConstants', 'hide file level constants', false)
    .option('-hx, --hideContracts', 'hide contracts', false)
    .option('-he, --hideEnums', 'hide enum types', false)
    .option('-hs, --hideStructs', 'hide data structures', false)
    .option('-hl, --hideLibraries', 'hide libraries', false)
    .option('-hi, --hideInterfaces', 'hide interfaces', false)
    .option('-ha, --hideAbstracts', 'hide abstract contracts', false)
    .option('-hn, --hideFilename', 'hide relative path and file name', false)
    .option('-s, --squash', 'squash inherited contracts to the base contract(s)', false)
    .option('-hsc, --hideSourceContract', 'hide the source contract when using squash', false)
    .action(async (fileFolderAddress, options, command) => {
    try {
        const combinedOptions = {
            ...command.parent._optionValues,
            ...options,
        };
        // Parse Solidity code from local file system or verified source code on Etherscan.
        let { umlClasses, contractName } = await (0, parserGeneral_1.parserUmlClasses)(fileFolderAddress, combinedOptions);
        if (options.squash &&
            // Must specify base contract(s) or parse from Etherscan to get contractName
            !options.baseContractNames &&
            !contractName) {
            throw Error('Must specify base contract(s) when using the squash option against local Solidity files.');
        }
        if (options.squash && options.hideContracts) {
            throw Error('Can not hide contracts when squashing contracts.');
        }
        if (options.baseContractNames) {
            contractName = options.baseContractNames[0];
        }
        // Filter out any class stereotypes that are to be hidden
        let filteredUmlClasses = (0, filterClasses_1.filterHiddenClasses)(umlClasses, options);
        // squash contracts
        if (options.squash) {
            filteredUmlClasses = (0, squashClasses_1.squashUmlClasses)(filteredUmlClasses, options.baseContractNames || [contractName]);
        }
        if (options.baseContractNames || options.squash) {
            // Find all the classes connected to the base classes after they have been squashed
            filteredUmlClasses = (0, filterClasses_1.classesConnectedToBaseContracts)(filteredUmlClasses, options.baseContractNames || [contractName], options.depth);
        }
        // Convert UML classes to Graphviz dot format.
        const dotString = (0, converterClasses2Dot_1.convertUmlClasses2Dot)(filteredUmlClasses, combinedOptions.clusterFolders, combinedOptions);
        // Convert Graphviz dot format to file formats. eg svg or png
        await (0, writerFiles_1.writeOutputFiles)(dotString, contractName || 'classDiagram', combinedOptions.outputFormat, combinedOptions.outputFileName);
        debug(`Finished generating UML`);
    }
    catch (err) {
        console.error(err);
        process.exit(2);
    }
});
program
    .command('storage')
    .usage('[options] <fileFolderAddress>')
    .description(`Visually display a contract's storage slots.

WARNING: sol2uml does not use the Solidity compiler so may differ with solc. A known example is fixed-sized arrays declared with an expression will fail to be sized.\n`)
    .argument('fileFolderAddress', argumentText)
    .option('-c, --contract <name>', 'Contract name in the local Solidity files. Not needed when using an address as the first argument as the contract name can be derived from Etherscan.')
    .option('-cf, --contractFile <filename>', 'Filename the contract is located in. This can include the relative path to the desired file.')
    .option('-d, --data', 'Gets the values in the storage slots from an Ethereum node.', false)
    .option('-s, --storage <address>', 'The address of the contract with the storage values. This will be different from the contract with the code if a proxy contract is used. This is not needed if `fileFolderAddress` is an address and the contract is not proxied.', validators_1.validateAddress)
    .addOption(new commander_1.Option('-u, --url <url>', 'URL of the Ethereum node to get storage values if the `data` option is used.')
    .env('NODE_URL')
    .default('http://localhost:8545'))
    .option('-bn, --block <number>', 'Block number to get the contract storage values from.', 'latest')
    .option('-sn, --slotNames <names>', 'Comma-separated list of slot names when accessed by assembly. The names can be a string, which will be hashed to a slot, or a 32 bytes hexadecimal string with a 0x prefix.', validators_1.validateSlotNames)
    .option('-st, --slotTypes <types>', 'Comma-separated list of types for the slots listed in the `slotNames` option. eg address,uint256,bool. If all types are the same, a single type can be used. eg address', validators_1.validateTypes, ['bytes32'])
    .option('-a, --array <number>', 'Number of slots to display at the start and end of arrays.', '2')
    .option('-hx, --hideExpand <variables>', "Comma-separated list of storage variables to not expand. That's arrays, structs, strings or bytes.", validators_1.validateNames)
    .option('-hv, --hideValues', 'Hide storage slot value column.', false)
    .action(async (fileFolderAddress, options, command) => {
    try {
        const combinedOptions = {
            ...command.parent._optionValues,
            ...options,
        };
        // If not an address and the contractName option has not been specified
        if (!(0, regEx_1.isAddress)(fileFolderAddress) && !combinedOptions.contract) {
            throw Error(`Must use the \`-c, --contract <name>\` option to specify the contract to draw the storage diagram for when sourcing from local files.\nThis option is not needed when sourcing from a blockchain explorer with a contract address.`);
        }
        let { umlClasses, contractName } = await (0, parserGeneral_1.parserUmlClasses)(fileFolderAddress, combinedOptions);
        contractName = combinedOptions.contract || contractName;
        const arrayItems = parseInt(combinedOptions.array);
        const storageSections = (0, converterClasses2Storage_1.convertClasses2StorageSections)(contractName, umlClasses, arrayItems, combinedOptions.contractFile, options.hideExpand);
        const optionVariables = (0, converterClasses2Storage_1.optionStorageVariables)(contractName, options.slotNames, options.slotTypes);
        storageSections[0].variables = [
            ...storageSections[0].variables,
            ...optionVariables,
        ];
        if ((0, regEx_1.isAddress)(fileFolderAddress)) {
            // The first storage is the contract
            storageSections[0].address = fileFolderAddress;
        }
        if (combinedOptions.data) {
            let storageAddress = combinedOptions.storage;
            if (storageAddress) {
                if (!(0, regEx_1.isAddress)(storageAddress)) {
                    throw Error(`Invalid address to get storage data from "${storageAddress}"`);
                }
            }
            else {
                if (!(0, regEx_1.isAddress)(fileFolderAddress)) {
                    throw Error(`Can not get storage slot values if first param is not an address and the \`--storage\` option is not used.`);
                }
                storageAddress = fileFolderAddress;
            }
            let block = await (0, block_1.getBlock)(combinedOptions);
            // Get slot values for each storage section
            for (const storageSection of storageSections) {
                await (0, slotValues_1.addSlotValues)(combinedOptions.url, storageAddress, storageSection, arrayItems, block);
                // Add storage variables for dynamic arrays, strings and bytes
                await (0, converterClasses2Storage_1.addDynamicVariables)(storageSection, storageSections, combinedOptions.url, storageAddress, arrayItems, block);
            }
        }
        const dotString = (0, converterStorage2Dot_1.convertStorages2Dot)(storageSections, combinedOptions);
        await (0, writerFiles_1.writeOutputFiles)(dotString, contractName || 'storageDiagram', combinedOptions.outputFormat, combinedOptions.outputFileName);
    }
    catch (err) {
        console.error(err);
        process.exit(2);
    }
});
program
    .command('flatten')
    .usage('<contractAddress>')
    .description(`Merges verified source files for a contract from a Blockchain explorer into one local Solidity file.

In order for the merged code to compile, the following is done:
1. pragma solidity is set using the compiler of the verified contract.
2. All pragma solidity lines in the source files are commented out.
3. File imports are commented out.
4. "SPDX-License-Identifier" is renamed to "SPDX--License-Identifier".
5. Contract dependencies are analysed so the files are merged in an order that will compile.\n`)
    .argument('<contractAddress>', 'Contract address in hexadecimal format with a 0x prefix.', validators_1.validateAddress)
    .action(async (contractAddress, options, command) => {
    try {
        debug(`About to flatten ${contractAddress}`);
        const combinedOptions = {
            ...command.parent._optionValues,
            ...options,
        };
        const etherscanParser = new parserEtherscan_1.EtherscanParser(combinedOptions.apiKey, combinedOptions.network, combinedOptions.explorerUrl);
        const { solidityCode, contractName } = await etherscanParser.getSolidityCode(contractAddress);
        // Write Solidity to the contract address
        const outputFilename = combinedOptions.outputFileName || contractName;
        await (0, writerFiles_1.writeSourceCode)(solidityCode, outputFilename);
    }
    catch (err) {
        console.error(err);
        process.exit(2);
    }
});
program
    .command('diff')
    .usage('[options] <addressA> <addressB or comma-separated folders>')
    .description(`Compare verified contract code on Etherscan-like explorers to another verified contract, a local file or multiple local files.

The results show the comparison of contract A to B.
The ${clc.green('green')} sections are additions to contract B that are not in contract A.
The ${clc.red('red')} sections are removals from contract A that are not in contract B.
The line numbers are from contract B. There are no line numbers for the red sections as they are not in contract B.\n`)
    .argument('<addressA>', 'Contract address in hexadecimal format with a 0x prefix of the first contract', validators_1.validateAddress)
    .argument('<fileFoldersAddress>', `Location of the contract source code to compare against. Can be a filename, comma-separated list of local folders or a contract address. Examples:
  "flat.sol" will compare against a local file called "flat.sol". This must be used when address A's verified source code is a single, flat file.
  ".,node_modules" will compare against local files under the current working folder and the node_modules folder. This is used when address A's verified source code is multiple files.
  0x1091588Cc431275F99DC5Df311fd8E1Ab81c89F3 will compare against the verified source code from Etherscan.`)
    .option('-s, --summary', 'Only show a summary of the file differences', false)
    .option('-af --aFile <value>', 'Limit code compare to contract A source file with the full path and extension as displayed in the file summary (default: compares all source files)')
    .option('-bf --bFile <value>', 'Contract B source file with the full path and extension as displayed in the file summary. Used if aFile is specified and the source file has been renamed (default: aFile if specified)')
    .addOption(new commander_1.Option('-bn, --bNetwork <network>', 'Ethereum network which maps to a blockchain explorer for contract B if on a different blockchain to contract A. Contract A uses the `network` option (default: value of `network` option)').choices(parserEtherscan_1.networks))
    .option('--flatten', 'Flatten into a single file before comparing. Only works when comparing two verified contracts, not to local files', false)
    .option('--saveFiles', 'Save the flattened contract code to the filesystem when using the `flatten` option. The file names will be the contract address with a .sol extension', false)
    .option('-l, --lineBuffer <value>', 'Minimum number of lines before and after changes (default: 4)', validators_1.validateLineBuffer)
    .action(async (addressA, fileFoldersAddress, options, command) => {
    try {
        debug(`About to compare ${addressA} to ${fileFoldersAddress}`);
        const combinedOptions = {
            ...command.parent._optionValues,
            ...options,
        };
        const aEtherscanParser = new parserEtherscan_1.EtherscanParser(combinedOptions.apiKey, combinedOptions.network, combinedOptions.explorerUrl);
        if ((0, regEx_1.isAddress)(fileFoldersAddress)) {
            const addressB = fileFoldersAddress;
            const bEtherscanParser = new parserEtherscan_1.EtherscanParser(combinedOptions.apiKey, combinedOptions.bNetwork || combinedOptions.network, combinedOptions.explorerUrl);
            // If flattening
            if (options.flatten) {
                await (0, diffContracts_1.compareFlattenContracts)(addressA, addressB, aEtherscanParser, bEtherscanParser, combinedOptions);
            }
            else {
                await (0, diffContracts_1.compareVerifiedContracts)(addressA, aEtherscanParser, addressB, bEtherscanParser, combinedOptions);
            }
        }
        else {
            const localFolders = fileFoldersAddress.split(',');
            await (0, diffContracts_1.compareVerified2Local)(addressA, aEtherscanParser, localFolders, combinedOptions);
        }
    }
    catch (err) {
        console.error(err);
        process.exit(2);
    }
});
program.on('option:verbose', () => {
    debugControl.enable('sol2uml,axios');
    debug('verbose on');
});
const main = async () => {
    await program.parseAsync(process.argv);
};
main();
//# sourceMappingURL=sol2uml.js.map