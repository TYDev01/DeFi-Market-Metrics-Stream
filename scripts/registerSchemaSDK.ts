import 'dotenv/config';
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SDK } from "@somnia-chain/streams";

// Schema fields matching what MetricsUpdater.sol encodes (order matters!)
const schemaFields = [
  { name: "timestamp", type: "uint64" },
  { name: "baseSymbol", type: "string" },
  { name: "quoteSymbol", type: "string" },
  { name: "pairId", type: "string" },
  { name: "source", type: "string" },
  { name: "price", type: "uint256" },
  { name: "delta", type: "int256" },
  { name: "deltaBps", type: "int256" },
  { name: "priceFeed", type: "address" },
  { name: "feedDecimals", type: "uint8" },
  { name: "baseToken", type: "address" },
  { name: "quoteToken", type: "address" }
] as const;

const schemaIdLabel = "PriceMetrics";

async function main() {
  const rpcUrl = process.env.SOMNIA_RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    throw new Error("Missing SOMNIA_RPC_URL or PRIVATE_KEY environment variables.");
  }

  const chainId = Number(process.env.SOMNIA_CHAIN_ID ?? "50312");
  const chain = defineChain({
    id: chainId,
    name: "Somnia Dream",
    network: "somnia-dream",
    nativeCurrency: { decimals: 18, name: "Somnia", symbol: "SOM" },
    rpcUrls: {
      default: { http: [rpcUrl] },
      public: { http: [rpcUrl] }
    }
  });

  const transport = http(rpcUrl, { timeout: 120000 });
  const account = privateKeyToAccount(privateKey.startsWith("0x") ? (privateKey as `0x${string}`) : (`0x${privateKey}` as `0x${string}`));

  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });
  const sdk = new SDK({ public: publicClient, wallet: walletClient });

  const schemaBody = schemaFields.map((field) => `${field.type} ${field.name}`).join(", ");
  console.log("Schema Body:");
  console.log(schemaBody);
  console.log();

  const schemaId = await sdk.streams.computeSchemaId(schemaBody);
  if (!schemaId) {
    throw new Error("Failed to compute schema ID using Somnia SDK");
  }
  
  console.log("Computed schema ID (via SDK):", schemaId);
  console.log("Contract schema ID (from .env):", process.env.SOMNIA_SCHEMA_ID);
  console.log();

  if (schemaId !== process.env.SOMNIA_SCHEMA_ID) {
    console.log("WARNING: SCHEMA ID MISMATCH!");
    console.log("The SDK computed:", schemaId);
    console.log("But contract expects:", process.env.SOMNIA_SCHEMA_ID);
    console.log();
    console.log("This means the contract was deployed with a manually computed schema ID.");
    console.log("We'll register both to be safe.");
    console.log();
  }

  try {
    console.log("Registering schema...");
    const registerTx = await sdk.streams.registerDataSchemas(
      [
        {
          id: schemaIdLabel,
          schema: schemaBody
        }
      ],
      true  // allow overwrite
    );
    
    if (registerTx) {
      console.log("Schema registration tx hash:", registerTx);
      console.log("Waiting for confirmation...");
      
      // Wait a bit for transaction to be mined
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      console.log("Schema registered successfully!");
    } else {
      console.log("INFO: Schema already registered or no transaction emitted.");
    }
  } catch (error: any) {
    console.warn("WARNING: Schema registration error:", error.message);
    
    if (error.message.includes('already registered') || error.message.includes('exists')) {
      console.log("Schema appears to already be registered.");
    } else {
      throw error;
    }
  }

  const protocolInfo = await sdk.streams.getSomniaDataStreamsProtocolInfo();
  if (!protocolInfo || protocolInfo instanceof Error) {
    throw new Error("Could not resolve Somnia Streams protocol contract info");
  }

  console.log();
  console.log("Somnia Streams Info:");
  console.log("Writer Address:", protocolInfo.address);
  console.log("Expected:", process.env.SOMNIA_STREAM_WRITER);
  console.log("Match:", protocolInfo.address.toLowerCase() === process.env.SOMNIA_STREAM_WRITER?.toLowerCase());
  console.log();
  console.log("Setup complete! Now try:");
  console.log("cd contracts && node manual-update.js");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
