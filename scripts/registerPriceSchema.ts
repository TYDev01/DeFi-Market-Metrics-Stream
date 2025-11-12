import 'dotenv/config';
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SDK } from "@somnia-chain/streams";

// Schema fields matching what MetricsUpdater.sol encodes
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

  const transport = http(rpcUrl);
  const account = privateKeyToAccount(privateKey.startsWith("0x") ? (privateKey as `0x${string}`) : (`0x${privateKey}` as `0x${string}`));

  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });
  const sdk = new SDK({ public: publicClient, wallet: walletClient });

  const schemaBody = schemaFields.map((field) => `${field.type} ${field.name}`).join(", ");
  console.log("Schema Body:", schemaBody);

  const schemaId = await sdk.streams.computeSchemaId(schemaBody);
  if (!schemaId) {
    throw new Error("Failed to compute schema ID");
  }
  console.log("Computed schema ID:", schemaId);
  console.log("Expected schema ID (from .env):", process.env.SOMNIA_SCHEMA_ID);
  console.log("Match:", schemaId === process.env.SOMNIA_SCHEMA_ID);

  if (schemaId !== process.env.SOMNIA_SCHEMA_ID) {
    console.error("\n SCHEMA ID MISMATCH!");
    console.error("The contract was deployed with a different schema ID than what we computed.");
    console.error("You need to either:");
    console.error("1. Register this new schema and redeploy the contract with the new schema ID");
    console.error("2. Update the contract's schema to match the registered one");
    process.exit(1);
  }

  try {
    console.log("\n Registering schema...");
    const registerTx = await sdk.streams.registerDataSchemas(
      [
        {
          id: schemaIdLabel,
          schema: schemaBody
        }
      ],
      true
    );
    if (registerTx) {
      console.log(" Schema registration tx hash:", registerTx);
    } else {
      console.log(" Schema already registered or no transaction emitted.");
    }
  } catch (error) {
    console.warn("  Schema registration failed:", error);
  }

  const protocolInfo = await sdk.streams.getSomniaDataStreamsProtocolInfo();
  if (!protocolInfo || protocolInfo instanceof Error) {
    throw new Error("Could not resolve Somnia Streams protocol contract info");
  }

  console.log("\n Somnia Streams Writer:", protocolInfo.address);
  console.log("Expected:", process.env.SOMNIA_STREAM_WRITER);
  console.log("Match:", protocolInfo.address.toLowerCase() === process.env.SOMNIA_STREAM_WRITER?.toLowerCase());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
