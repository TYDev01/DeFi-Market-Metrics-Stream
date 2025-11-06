// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";

import { MetricsUpdater, ISomniaStreamWriter, AggregatorV3Interface } from "../src/MetricsUpdater.sol";

contract MockAggregator is AggregatorV3Interface {
    uint8 public override decimals;
    int256 private answer;
    uint256 private updatedAt;

    constructor(uint8 _decimals, int256 _answer) {
        decimals = _decimals;
        answer = _answer;
        updatedAt = block.timestamp;
    }

    function setAnswer(int256 _answer) external {
        answer = _answer;
        updatedAt = block.timestamp;
    }

    function latestRoundData()
        external
        view
        override
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (0, answer, updatedAt, updatedAt, 0);
    }
}

contract MockSomniaStream is ISomniaStreamWriter {
    bytes32 public schemaId;
    bytes32 public lastDataKey;
    bytes public lastEncodedData;
    uint256 public writeCount;

    function set(bytes32 _schemaId, bytes32 dataKey, bytes calldata encodedData) external override {
        schemaId = _schemaId;
        lastDataKey = dataKey;
        lastEncodedData = encodedData;
        writeCount++;
    }
}

contract MetricsUpdaterTest is Test {
    MetricsUpdater private updater;
    MockSomniaStream private somnia;
    MockAggregator private baseFeed;
    MockAggregator private quoteFeed;

    bytes32 private constant SCHEMA_ID = bytes32(uint256(0x1234));

    function setUp() public {
        somnia = new MockSomniaStream();
        baseFeed = new MockAggregator(8, 2000e8); // 2000 USD
        quoteFeed = new MockAggregator(8, 1000e8); // 1000 USD

        MetricsUpdater.PoolConfig[] memory configs = new MetricsUpdater.PoolConfig[](1);
        configs[0] = MetricsUpdater.PoolConfig({
            baseFeed: address(baseFeed),
            quoteFeed: address(quoteFeed),
            baseLiquidity: 1_000e18,
            quoteLiquidity: 500e18,
            feeBps: 30,
            protocol: "SomniaSwap",
            network: "Somnia",
            poolId: "ETH-USD",
            baseToken: "ETH",
            quoteToken: "USD"
        });

        updater = new MetricsUpdater(ISomniaStreamWriter(somnia), SCHEMA_ID);
        updater.initPools(configs);
        updater.setInterval(60);
        vm.warp(block.timestamp + 120);
    }

    function testPerformUpkeepWritesToSomnia() public {
        (bool upkeep,) = updater.checkUpkeep("");
        assertTrue(upkeep, "upkeep required");

        updater.performUpkeep("");

        assertEq(somnia.writeCount(), 1, "write count");
        assertEq(somnia.schemaId(), SCHEMA_ID, "schema");

        (MetricsUpdater.PoolConfig memory config,) =
            updater.getPool(updater.computeDataKey("SomniaSwap", "Somnia", "ETH-USD"));
        assertEq(config.baseToken, "ETH");
    }

    function testIntervalsRespected() public {
        updater.performUpkeep("");
        vm.expectRevert();
        updater.performUpkeep("");
    }
}
