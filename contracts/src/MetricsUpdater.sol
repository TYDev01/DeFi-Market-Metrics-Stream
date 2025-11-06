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

contract MetricsUpdater is AutomationCompatibleInterface {
    struct PoolConfig {
        address baseFeed;
        address quoteFeed;
        uint256 baseLiquidity;
        uint256 quoteLiquidity;
        uint16 feeBps;
        string protocol;
        string network;
        string poolId;
        string baseToken;
        string quoteToken;
    }

    struct PoolState {
        uint256 lastTvlUsd;
        uint64 lastTimestamp;
        int256 lastAprBps;
    }

    ISomniaStreamWriter public immutable somniaStream;
    bytes32 public immutable schemaId;
    address public owner;

    uint64 public lastUpkeepTimestamp;
    uint32 public interval = 10 minutes;

    bytes32[] private poolKeys;
    mapping(bytes32 => PoolConfig) private poolConfigs;
    mapping(bytes32 => PoolState) public poolStates;

    event PoolRegistered(bytes32 indexed poolKey, string protocol, string network, string poolId);
    event PoolUpdated(bytes32 indexed poolKey);
    event IntervalUpdated(uint32 interval);
    event MetricsPushed(
        bytes32 indexed poolKey,
        uint64 timestamp,
        uint256 tvlUsd,
        uint256 volume24hUsd,
        uint256 fees24hUsd,
        int256 aprBps
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

    /// @notice one-time initializer to register initial pools after deployment
    function initPools(PoolConfig[] calldata configs) external onlyOwner {
        require(poolKeys.length == 0, "MetricsUpdater: already initialized");

        for (uint256 i = 0; i < configs.length; i++) {
            _registerPool(configs[i]);
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "MetricsUpdater: zero addr");
        owner = newOwner;
    }

    function registerPool(PoolConfig calldata config) external onlyOwner {
        PoolConfig memory copy = PoolConfig({
            baseFeed: config.baseFeed,
            quoteFeed: config.quoteFeed,
            baseLiquidity: config.baseLiquidity,
            quoteLiquidity: config.quoteLiquidity,
            feeBps: config.feeBps,
            protocol: config.protocol,
            network: config.network,
            poolId: config.poolId,
            baseToken: config.baseToken,
            quoteToken: config.quoteToken
        });
        _registerPool(copy);
    }

    function updatePool(
        address baseFeed,
        address quoteFeed,
        uint256 baseLiquidity,
        uint256 quoteLiquidity,
        uint16 feeBps,
        bytes32 poolKey
    ) external onlyOwner {
        PoolConfig storage stored = poolConfigs[poolKey];
        require(bytes(stored.protocol).length != 0, "MetricsUpdater: pool missing");

        stored.baseFeed = baseFeed;
        stored.quoteFeed = quoteFeed;
        stored.baseLiquidity = baseLiquidity;
        stored.quoteLiquidity = quoteLiquidity;
        stored.feeBps = feeBps;

        emit PoolUpdated(poolKey);
    }

    function setInterval(uint32 newInterval) external onlyOwner {
        require(newInterval >= 60, "MetricsUpdater: interval too small");
        interval = newInterval;
        emit IntervalUpdated(newInterval);
    }

    function poolCount() external view returns (uint256) {
        return poolKeys.length;
    }

    function poolKeyAt(uint256 index) external view returns (bytes32) {
        require(index < poolKeys.length, "MetricsUpdater: index out of bounds");
        return poolKeys[index];
    }

    function getPool(bytes32 poolKey) external view returns (PoolConfig memory config, PoolState memory state) {
        config = poolConfigs[poolKey];
        require(bytes(config.protocol).length != 0, "MetricsUpdater: pool missing");
        state = poolStates[poolKey];
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

        for (uint256 i = 0; i < poolKeys.length; i++) {
            bytes32 poolKey = poolKeys[i];
            PoolConfig storage config = poolConfigs[poolKey];
            PoolState storage state = poolStates[poolKey];

            (uint256 basePrice, uint8 baseDecimals) = _latestPrice(config.baseFeed);
            (uint256 quotePrice, uint8 quoteDecimals) = _latestPrice(config.quoteFeed);

            uint256 baseUsd = _toUsd(config.baseLiquidity, basePrice, baseDecimals);
            uint256 quoteUsd = _toUsd(config.quoteLiquidity, quotePrice, quoteDecimals);
            uint256 tvlUsd = baseUsd + quoteUsd;

            uint256 previousTvl = state.lastTvlUsd;
            uint256 volume24hUsd = previousTvl == 0 ? 0 : _absDiff(tvlUsd, previousTvl);
            uint256 fees24hUsd = (volume24hUsd * config.feeBps) / 1e4;

            int256 aprBps = _computeAprBps(previousTvl, tvlUsd, state.lastTimestamp, config.feeBps);
            state.lastTvlUsd = tvlUsd;
            state.lastTimestamp = uint64(block.timestamp);
            state.lastAprBps = aprBps;

            bytes memory encodedData = abi.encode(
                uint64(block.timestamp),
                config.protocol,
                config.network,
                config.poolId,
                config.baseToken,
                config.quoteToken,
                tvlUsd,
                volume24hUsd,
                fees24hUsd,
                aprBps
            );

            somniaStream.set(schemaId, poolKey, encodedData);

            emit MetricsPushed(poolKey, uint64(block.timestamp), tvlUsd, volume24hUsd, fees24hUsd, aprBps);
        }
    }

    function _computeAprBps(
        uint256 previousTvl,
        uint256 tvlUsd,
        uint64 lastTimestamp,
        uint16 feeBps
    ) internal view returns (int256) {
        if (previousTvl == 0 || lastTimestamp == 0) {
            return int256(uint256(feeBps) * 365);
        }

        uint256 elapsed = block.timestamp - lastTimestamp;
        if (elapsed == 0 || previousTvl == 0) {
            return int256(uint256(feeBps) * 365);
        }

        int256 pnl = int256(tvlUsd) - int256(previousTvl);
        int256 rate = (pnl * int256(1e4)) / int256(previousTvl);
        int256 apr = (rate * int256(365 days)) / int256(elapsed);

        if (apr > int256(500_000)) {
            apr = int256(500_000);
        } else if (apr < int256(-500_000)) {
            apr = int256(-500_000);
        }
        return apr;
    }

    function _registerPool(PoolConfig memory config) internal {
        bytes32 poolKey = _computeDataKey(config.protocol, config.network, config.poolId);
        require(bytes(poolConfigs[poolKey].protocol).length == 0, "MetricsUpdater: pool exists");

        poolKeys.push(poolKey);

        PoolConfig storage stored = poolConfigs[poolKey];
        stored.baseFeed = config.baseFeed;
        stored.quoteFeed = config.quoteFeed;
        stored.baseLiquidity = config.baseLiquidity;
        stored.quoteLiquidity = config.quoteLiquidity;
        stored.feeBps = config.feeBps;
        stored.protocol = config.protocol;
        stored.network = config.network;
        stored.poolId = config.poolId;
        stored.baseToken = config.baseToken;
        stored.quoteToken = config.quoteToken;

        emit PoolRegistered(poolKey, config.protocol, config.network, config.poolId);
    }

    function _latestPrice(address feed) internal view returns (uint256 price, uint8 decimals_) {
        require(feed != address(0), "MetricsUpdater: missing feed");

        (, int256 answer,, uint256 updatedAt,) = AggregatorV3Interface(feed).latestRoundData();
        require(answer > 0, "MetricsUpdater: invalid price");
        require(updatedAt > 0, "MetricsUpdater: stale price");

        price = uint256(answer);
        decimals_ = AggregatorV3Interface(feed).decimals();
    }

    function _toUsd(uint256 amount, uint256 price, uint8 priceDecimals) internal pure returns (uint256) {
        if (amount == 0 || price == 0) {
            return 0;
        }

        uint256 decimalsFactor = 10 ** uint256(priceDecimals);
        return (amount * price) / decimalsFactor / 1e18;
    }

    function _absDiff(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a - b : b - a;
    }

    function _computeDataKey(
        string memory protocol,
        string memory network,
        string memory poolId
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(protocol, ":", network, ":", poolId));
    }

    function computeDataKey(
        string calldata protocol,
        string calldata network,
        string calldata poolId
    ) external pure returns (bytes32) {
        return _computeDataKey(protocol, network, poolId);
    }
}
