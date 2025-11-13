#!/bin/bash

# Script to manually trigger price updates on the MetricsUpdater contract
# This is useful for testing before setting up Chainlink Automation

set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check required environment variables
if [ -z "$METRICS_UPDATER_ADDRESS" ]; then
    echo "Error: METRICS_UPDATER_ADDRESS not set in .env"
    exit 1
fi

if [ -z "$SOMNIA_RPC_URL" ]; then
    echo "Error: SOMNIA_RPC_URL not set in .env"
    exit 1
fi

if [ -z "$PRIVATE_KEY" ]; then
    echo "Error: PRIVATE_KEY not set in .env"
    exit 1
fi

echo "================================================"
echo "MetricsUpdater Manual Update Script"
echo "================================================"
echo ""
echo "Contract: $METRICS_UPDATER_ADDRESS"
echo "RPC URL: $SOMNIA_RPC_URL"
echo ""

# Check if upkeep is needed
echo "Checking if update is needed..."
UPKEEP_NEEDED=$(cast call $METRICS_UPDATER_ADDRESS "checkUpkeep(bytes)" "0x" --rpc-url $SOMNIA_RPC_URL | head -n 1)

echo "Upkeep needed: $UPKEEP_NEEDED"
echo ""

# Get current state
echo "Current contract state:"
echo "-----------------------"

PAIR_COUNT=$(cast call $METRICS_UPDATER_ADDRESS "pairCount()" --rpc-url $SOMNIA_RPC_URL)
echo "Registered pairs: $((PAIR_COUNT))"

LAST_UPDATE=$(cast call $METRICS_UPDATER_ADDRESS "lastUpkeepTimestamp()" --rpc-url $SOMNIA_RPC_URL)
LAST_UPDATE_DEC=$((LAST_UPDATE))
LAST_UPDATE_DATE=$(date -d @$LAST_UPDATE_DEC 2>/dev/null || date -r $LAST_UPDATE_DEC 2>/dev/null || echo "N/A")
echo "Last update: $LAST_UPDATE_DATE ($LAST_UPDATE_DEC)"

INTERVAL=$(cast call $METRICS_UPDATER_ADDRESS "interval()" --rpc-url $SOMNIA_RPC_URL)
INTERVAL_SEC=$((INTERVAL))
echo "Update interval: $INTERVAL_SEC seconds ($((INTERVAL_SEC / 60)) minutes)"

CURRENT_TIME=$(date +%s)
TIME_SINCE_UPDATE=$((CURRENT_TIME - LAST_UPDATE_DEC))
TIME_UNTIL_NEXT=$((INTERVAL_SEC - TIME_SINCE_UPDATE))

echo "Time since last update: $TIME_SINCE_UPDATE seconds"
if [ $TIME_UNTIL_NEXT -gt 0 ]; then
    echo "Time until next update: $TIME_UNTIL_NEXT seconds ($((TIME_UNTIL_NEXT / 60)) minutes)"
else
    echo "Update is overdue by $((TIME_UNTIL_NEXT * -1)) seconds"
fi

echo ""
echo "-----------------------"
echo ""

# Perform update
read -p "Do you want to trigger an update now? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Triggering update..."
    echo ""
    
    TX_HASH=$(cast send $METRICS_UPDATER_ADDRESS "performUpkeep(bytes)" "0x" \
        --rpc-url $SOMNIA_RPC_URL \
        --private-key $PRIVATE_KEY \
        --legacy 2>&1 | grep "transactionHash" | awk '{print $2}')
    
    if [ -n "$TX_HASH" ]; then
        echo "✓ Update triggered successfully!"
        echo "Transaction hash: $TX_HASH"
        echo ""
        echo "Waiting for confirmation..."
        sleep 5
        
        # Get new state
        NEW_LAST_UPDATE=$(cast call $METRICS_UPDATER_ADDRESS "lastUpkeepTimestamp()" --rpc-url $SOMNIA_RPC_URL)
        NEW_LAST_UPDATE_DEC=$((NEW_LAST_UPDATE))
        NEW_LAST_UPDATE_DATE=$(date -d @$NEW_LAST_UPDATE_DEC 2>/dev/null || date -r $NEW_LAST_UPDATE_DEC 2>/dev/null || echo "N/A")
        
        echo "New last update: $NEW_LAST_UPDATE_DATE ($NEW_LAST_UPDATE_DEC)"
        echo ""
        echo "✓ Prices updated successfully!"
        echo ""
        echo "You can now check the dashboard to see the latest prices."
    else
        echo "✗ Failed to trigger update. Check your configuration and try again."
        exit 1
    fi
else
    echo "Update cancelled."
fi

echo ""
echo "================================================"
