// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {MetricsUpdater, ISomniaStreamWriter, AggregatorV3Interface} from "../src/MetricsUpdater.sol";

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
    MockAggregator private feed;

    bytes32 private constant SCHEMA_ID = bytes32(uint256(0x1234));
    address private constant BASE_TOKEN = address(0xBEEF);
    address private constant QUOTE_TOKEN = address(0xCAFE);
    bytes32 private pairKey;

    function setUp() public {
        somnia = new MockSomniaStream();
        feed = new MockAggregator(8, 2_000e8);

        MetricsUpdater.PairInput[] memory inputs = new MetricsUpdater.PairInput[](1);
        inputs[0] = MetricsUpdater.PairInput({
            priceFeed: address(feed),
            baseToken: BASE_TOKEN,
            quoteToken: QUOTE_TOKEN,
            baseSymbol: "SOM",
            quoteSymbol: "USDT",
            pairId: "SOM-USDT",
            source: "Chainlink"
        });

        updater = new MetricsUpdater(ISomniaStreamWriter(somnia), SCHEMA_ID);
        updater.initPairs(inputs);
        updater.setInterval(60);

        pairKey = updater.computePairKey(BASE_TOKEN, QUOTE_TOKEN, "SOM-USDT");

        vm.warp(block.timestamp + 120);
    }

    function testPerformUpkeepEncodesPairData() public {
        (bool upkeep,) = updater.checkUpkeep("");
        assertTrue(upkeep, "upkeep required");

        updater.performUpkeep("");

        assertEq(somnia.writeCount(), 1, "write count");
        assertEq(somnia.lastDataKey(), pairKey, "pair key");

        (
            uint64 timestamp,
            string memory baseSymbol,
            string memory quoteSymbol,
            string memory pairId,
            string memory source,
            uint256 price,
            int256 delta,
            int256 deltaBps,
            address priceFeed,
            uint8 decimals,
            address baseToken,
            address quoteToken
        ) = abi.decode(
            somnia.lastEncodedData(),
            (uint64, string, string, string, string, uint256, int256, int256, address, uint8, address, address)
        );

        assertEq(baseSymbol, "SOM");
        assertEq(quoteSymbol, "USDT");
        assertEq(pairId, "SOM-USDT");
        assertEq(source, "Chainlink");
        assertEq(priceFeed, address(feed));
        assertEq(decimals, 8);
        assertEq(baseToken, BASE_TOKEN);
        assertEq(quoteToken, QUOTE_TOKEN);
        assertEq(price, uint256(2_000e8));
        assertEq(delta, 0);
        assertEq(deltaBps, 0);
        assertGt(timestamp, 0);
    }

    function testPriceChangeCalculations() public {
        updater.performUpkeep("");

        vm.warp(block.timestamp + 120);
        feed.setAnswer(2_100e8);

        updater.performUpkeep("");

        (, MetricsUpdater.PairState memory state) = updater.getPair(pairKey);
        assertEq(state.lastPrice, uint256(2_100e8));
        assertEq(state.lastChangeBps, int256(500));
    }

    function testUpdatePairRequiresMatchingId() public {
        MetricsUpdater.PairInput memory input = MetricsUpdater.PairInput({
            priceFeed: address(feed),
            baseToken: BASE_TOKEN,
            quoteToken: QUOTE_TOKEN,
            baseSymbol: "SOM",
            quoteSymbol: "USDT",
            pairId: "SOM-USDT",
            source: "Manual"
        });

        updater.updatePair(pairKey, input);

        (, MetricsUpdater.PairState memory stateBefore) = updater.getPair(pairKey);
        assertEq(stateBefore.lastPrice, 0);

        vm.expectRevert("MetricsUpdater: pair id mismatch");
        input.pairId = "DIFF";
        updater.updatePair(pairKey, input);
    }

    function testIntervalsRespected() public {
        updater.performUpkeep("");
        vm.expectRevert("MetricsUpdater: upkeep not due");
        updater.performUpkeep("");
    }
}
