import 'dotenv/config';
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SDK } from "@somnia-chain/streams";

const schemaFields = [
  { name: "timestamp", type: "uint64" },
  { name: "protocol", type: "string" },
  { name: "network", type: "string" },
  { name: "poolId", type: "string" },
  { name: "baseToken", type: "string" },
  { name: "quoteToken", type: "string" },
  { name: "tvlUsd", type: "uint256" },
  { name: "volume24hUsd", type: "uint256" },
  { name: "fees24hUsd", type: "uint256" },
  { name: "aprBps", type: "int256" }
] as const;

const schemaIdLabel = process.env.SOMNIA_SCHEMA_NAME ?? "SomniaDefiMetrics";

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

  const schemaId = await sdk.streams.computeSchemaId(schemaBody);
  if (!schemaId) {
    throw new Error("Failed to compute schema ID");
  }
  console.log("Computed schema ID:", schemaId);

  try {
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
      console.log("Schema registration tx hash:", registerTx);
    } else {
      console.log("Schema already registered or no transaction emitted.");
    }
  } catch (error) {
    console.warn("Schema registration failed:", error);
  }

  const protocolInfo = await sdk.streams.getSomniaDataStreamsProtocolInfo();
  if (!protocolInfo || protocolInfo instanceof Error) {
    throw new Error("Could not resolve Somnia Streams protocol contract info");
  }

  console.log("Somnia Streams protocol contract:", protocolInfo.address);
  console.log("Copy the schema ID and protocol address into your .env as SOMNIA_SCHEMA_ID and SOMNIA_STREAM_WRITER.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
