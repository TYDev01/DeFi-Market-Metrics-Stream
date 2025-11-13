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

        vm.startBroadcast();

        MetricsUpdater updater = new MetricsUpdater(ISomniaStreamWriter(somniaStreamWriter), schemaId);

        console2.log("MetricsUpdater deployed at:", address(updater));
        console2.log("Somnia writer:", somniaStreamWriter);
        console2.log("Schema ID (bytes32):");
        console2.logBytes32(schemaId);

        if (address(updater.owner()) != owner) {
            updater.transferOwnership(owner);
            console2.log("Ownership transferred to:", owner);
        }

        vm.stopBroadcast();
    }
}



