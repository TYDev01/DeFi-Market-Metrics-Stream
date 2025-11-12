// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import {MetricsUpdater} from "../src/MetricsUpdater.sol";

contract InitPairs is Script {
    function run() external {
        address updaterAddress = vm.envAddress("METRICS_UPDATER_ADDRESS");
        uint256 pairCount = vm.envOr("PAIR_COUNT", uint256(0));
        require(pairCount > 0, "PAIR_COUNT missing");

        MetricsUpdater.PairInput[] memory inputs = new MetricsUpdater.PairInput[](pairCount);

        for (uint256 i = 0; i < pairCount; i++) {
            string memory index = vm.toString(i);
            string memory prefix = string.concat("PAIR", index, "_");
            inputs[i] = MetricsUpdater.PairInput({
                priceFeed: vm.envAddress(string.concat(prefix, "FEED")),
                baseToken: vm.envAddress(string.concat(prefix, "BASE_ADDRESS")),
                quoteToken: vm.envAddress(string.concat(prefix, "QUOTE_ADDRESS")),
                baseSymbol: vm.envString(string.concat(prefix, "BASE_SYMBOL")),
                quoteSymbol: vm.envString(string.concat(prefix, "QUOTE_SYMBOL")),
                pairId: vm.envString(string.concat(prefix, "PAIR_ID")),
                source: vm.envString(string.concat(prefix, "SOURCE"))
            });
        }

        MetricsUpdater updater = MetricsUpdater(updaterAddress);

        vm.startBroadcast();
        updater.initPairs(inputs);
        vm.stopBroadcast();

        console2.log("InitPairs executed for MetricsUpdater:", updaterAddress);
        console2.log("Pairs initialised:", pairCount);
    }
}
