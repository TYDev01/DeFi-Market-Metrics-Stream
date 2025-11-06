// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import {MetricsUpdater} from "../src/MetricsUpdater.sol";

contract InitPools is Script {
    function run() external {
        address updaterAddress = vm.envAddress("METRICS_UPDATER_ADDRESS");
        uint256 poolCount = vm.envOr("POOL_COUNT", uint256(1));

        MetricsUpdater.PoolConfig[] memory configs = new MetricsUpdater.PoolConfig[](poolCount);

        for (uint256 i = 0; i < poolCount; i++) {
            string memory index = vm.toString(i);
            string memory prefix = string.concat("POOL", index, "_");
            configs[i] = MetricsUpdater.PoolConfig({
                baseFeed: vm.envAddress(string.concat(prefix, "BASE_FEED")),
                quoteFeed: vm.envAddress(string.concat(prefix, "QUOTE_FEED")),
                baseLiquidity: vm.envUint(string.concat(prefix, "BASE_LIQUIDITY")),
                quoteLiquidity: vm.envUint(string.concat(prefix, "QUOTE_LIQUIDITY")),
                feeBps: uint16(vm.envUint(string.concat(prefix, "FEE_BPS"))),
                protocol: vm.envString(string.concat(prefix, "PROTOCOL")),
                network: vm.envString(string.concat(prefix, "NETWORK")),
                poolId: vm.envString(string.concat(prefix, "POOL_ID")),
                baseToken: vm.envString(string.concat(prefix, "BASE_TOKEN")),
                quoteToken: vm.envString(string.concat(prefix, "QUOTE_TOKEN"))
            });
        }

        MetricsUpdater updater = MetricsUpdater(updaterAddress);

        vm.startBroadcast();
        updater.initPools(configs);
        vm.stopBroadcast();

        console2.log("InitPools executed for MetricsUpdater:", updaterAddress);
        console2.log("Pools initialised:", poolCount);
    }
}
