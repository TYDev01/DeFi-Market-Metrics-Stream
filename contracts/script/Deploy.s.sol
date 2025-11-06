// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

import {MetricsUpdater, ISomniaStreamWriter} from "../src/MetricsUpdater.sol";

contract DeployMetricsUpdater is Script {
    function run() external {
        address owner = vm.envAddress("OWNER_ADDRESS");
        address somniaStreamWriter = vm.envAddress("SOMNIA_STREAM_WRITER");
        bytes32 schemaId = vm.envBytes32("SOMNIA_SCHEMA_ID");

        MetricsUpdater.PoolConfig[] memory configs = new MetricsUpdater.PoolConfig[](1);
        configs[0] = MetricsUpdater.PoolConfig({
            baseFeed: vm.envAddress("POOL0_BASE_FEED"),
            quoteFeed: vm.envAddress("POOL0_QUOTE_FEED"),
            baseLiquidity: vm.envUint("POOL0_BASE_LIQUIDITY"),
            quoteLiquidity: vm.envUint("POOL0_QUOTE_LIQUIDITY"),
            feeBps: uint16(vm.envUint("POOL0_FEE_BPS")),
            protocol: vm.envString("POOL0_PROTOCOL"),
            network: vm.envString("POOL0_NETWORK"),
            poolId: vm.envString("POOL0_POOL_ID"),
            baseToken: vm.envString("POOL0_BASE_TOKEN"),
            quoteToken: vm.envString("POOL0_QUOTE_TOKEN")
        });

        vm.startBroadcast(owner);
        MetricsUpdater updater = new MetricsUpdater(
            ISomniaStreamWriter(somniaStreamWriter),
            schemaId,
            configs
        );
        vm.stopBroadcast();

        console2.log("MetricsUpdater deployed at", address(updater));
    }
}
