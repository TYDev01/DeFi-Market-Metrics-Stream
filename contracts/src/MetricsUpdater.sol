// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

interface AutomationCompatibleInterface {
    function checkUpkeep(bytes calldata checkData) external returns (bool upkeepNeeded, bytes memory performData);

    function performUpkeep(bytes calldata performData) external;
}

interface ISomniaStreamWriter {
    function set(bytes32 schemaId, bytes32 dataKey, bytes calldata encodedData) external;
}

/// @notice Streams Chainlink price feeds for arbitrary ERC-20 pairs into Somnia Data Streams.
contract MetricsUpdater is AutomationCompatibleInterface {
    struct PairInput {
        address priceFeed;
        address baseToken;
        address quoteToken;
        string baseSymbol;
        string quoteSymbol;
        string pairId;
        string source;
    }

    struct PairConfig {
        address priceFeed;
        address baseToken;
        address quoteToken;
        uint8 feedDecimals;
        string baseSymbol;
        string quoteSymbol;
        string pairId;
        string source;
    }

    struct PairState {
        uint256 lastPrice;
        int256 lastChangeBps;
        uint64 lastTimestamp;
    }

    ISomniaStreamWriter public immutable somniaStream;
    bytes32 public immutable schemaId;
    address public owner;

    uint64 public lastUpkeepTimestamp;
    uint32 public interval = 10 minutes;

    bytes32[] private pairKeys;
    mapping(bytes32 => PairConfig) private pairConfigs;
    mapping(bytes32 => PairState) public pairStates;

    event PairRegistered(bytes32 indexed pairKey, string pairId, address baseToken, address quoteToken);
    event PairUpdated(bytes32 indexed pairKey);
    event IntervalUpdated(uint32 interval);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PricePushed(
        bytes32 indexed pairKey,
        uint64 timestamp,
        uint256 price,
        int256 delta,
        int256 deltaBps,
        uint8 decimals
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "MetricsUpdater: not owner");
        _;
    }

    constructor(ISomniaStreamWriter _somniaStream, bytes32 _schemaId) {
        owner = msg.sender;
        somniaStream = _somniaStream;
        schemaId = _schemaId;
        lastUpkeepTimestamp = uint64(block.timestamp);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "MetricsUpdater: zero addr");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setInterval(uint32 newInterval) external onlyOwner {
        require(newInterval >= 60, "MetricsUpdater: interval too small");
        interval = newInterval;
        emit IntervalUpdated(newInterval);
    }

    function initPairs(PairInput[] calldata inputs) external onlyOwner {
        require(pairKeys.length == 0, "MetricsUpdater: already initialized");
        for (uint256 i = 0; i < inputs.length; i++) {
            _registerPair(inputs[i]);
        }
    }

    function registerPair(PairInput calldata input) external onlyOwner {
        _registerPair(input);
    }

    function updatePair(bytes32 pairKey, PairInput calldata nextConfig) external onlyOwner {
        PairConfig storage stored = pairConfigs[pairKey];
        require(bytes(stored.pairId).length != 0, "MetricsUpdater: pair missing");
        require(
            keccak256(bytes(stored.pairId)) == keccak256(bytes(nextConfig.pairId)),
            "MetricsUpdater: pair id mismatch"
        );
        _writeConfig(stored, nextConfig);
        emit PairUpdated(pairKey);
    }

    function pairCount() external view returns (uint256) {
        return pairKeys.length;
    }

    function pairKeyAt(uint256 index) external view returns (bytes32) {
        require(index < pairKeys.length, "MetricsUpdater: index out of bounds");
        return pairKeys[index];
    }

    function getPair(bytes32 pairKey) external view returns (PairConfig memory config, PairState memory state) {
        config = pairConfigs[pairKey];
        require(bytes(config.pairId).length != 0, "MetricsUpdater: pair missing");
        state = pairStates[pairKey];
    }

    function checkUpkeep(bytes calldata)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        upkeepNeeded = block.timestamp >= (lastUpkeepTimestamp + interval);
        performData = bytes("");
    }

    function performUpkeep(bytes calldata) external override {
        require(block.timestamp >= (lastUpkeepTimestamp + interval), "MetricsUpdater: upkeep not due");
        lastUpkeepTimestamp = uint64(block.timestamp);

        uint256 length = pairKeys.length;
        for (uint256 i = 0; i < length; i++) {
            bytes32 pairKey = pairKeys[i];
            PairConfig storage config = pairConfigs[pairKey];
            PairState storage state = pairStates[pairKey];

            (uint256 price) = _latestPrice(config.priceFeed);

            uint256 previousPrice = state.lastPrice;
            int256 delta = previousPrice == 0 ? int256(0) : int256(price) - int256(previousPrice);
            int256 deltaBps = previousPrice == 0
                ? int256(0)
                : (delta * int256(10_000)) / int256(previousPrice);

            state.lastPrice = price;
            state.lastTimestamp = uint64(block.timestamp);
            state.lastChangeBps = deltaBps;

            bytes memory encodedData = abi.encode(
                uint64(block.timestamp),
                config.baseSymbol,
                config.quoteSymbol,
                config.pairId,
                config.source,
                price,
                delta,
                deltaBps,
                config.priceFeed,
                config.feedDecimals,
                config.baseToken,
                config.quoteToken
            );

            somniaStream.set(schemaId, pairKey, encodedData);

            emit PricePushed(pairKey, uint64(block.timestamp), price, delta, deltaBps, config.feedDecimals);
        }
    }

    function computePairKey(
        address baseToken,
        address quoteToken,
        string calldata pairId
    ) external pure returns (bytes32) {
        return _computePairKey(baseToken, quoteToken, pairId);
    }

    function _registerPair(PairInput memory input) internal {
        require(input.priceFeed != address(0), "MetricsUpdater: missing feed");
        require(input.baseToken != address(0), "MetricsUpdater: missing base token");
        require(bytes(input.baseSymbol).length != 0, "MetricsUpdater: base symbol missing");
        require(bytes(input.quoteSymbol).length != 0, "MetricsUpdater: quote symbol missing");
        require(bytes(input.pairId).length != 0, "MetricsUpdater: pair id missing");

        bytes32 pairKey = _computePairKey(input.baseToken, input.quoteToken, input.pairId);
        require(bytes(pairConfigs[pairKey].pairId).length == 0, "MetricsUpdater: pair exists");

        pairKeys.push(pairKey);
        PairConfig storage stored = pairConfigs[pairKey];
        _writeConfig(stored, input);

        emit PairRegistered(pairKey, input.pairId, input.baseToken, input.quoteToken);
    }

    function _writeConfig(PairConfig storage stored, PairInput memory input) internal {
        stored.priceFeed = input.priceFeed;
        stored.baseToken = input.baseToken;
        stored.quoteToken = input.quoteToken;
        stored.baseSymbol = input.baseSymbol;
        stored.quoteSymbol = input.quoteSymbol;
        stored.pairId = input.pairId;
        stored.source = input.source;
        stored.feedDecimals = _readFeedDecimals(input.priceFeed);
    }

    function _computePairKey(
        address baseToken,
        address quoteToken,
        string memory pairId
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(baseToken, quoteToken, pairId));
    }

    function _latestPrice(address feed) internal view returns (uint256 price) {
        require(feed != address(0), "MetricsUpdater: missing feed");
        (, int256 answer,, uint256 updatedAt,) = AggregatorV3Interface(feed).latestRoundData();
        require(answer > 0, "MetricsUpdater: invalid price");
        require(updatedAt > 0, "MetricsUpdater: stale price");
        price = uint256(answer);
    }

    function _readFeedDecimals(address feed) internal view returns (uint8) {
        require(feed != address(0), "MetricsUpdater: missing feed");
        return AggregatorV3Interface(feed).decimals();
    }
}
