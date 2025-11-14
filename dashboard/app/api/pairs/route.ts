import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyMessage } from 'viem';

const USER_PAIRS_FILE = path.join(process.cwd(), '../../data/user-pairs.json');
const DAILY_LIMIT = 2;

interface UserPair {
  id: string;
  walletAddress: string;
  baseToken: string;
  quoteToken: string;
  pairId: string;
  feed: string;
  network: 'somnia' | 'ethereum';
  rpcUrl: string;
  addedAt: number;
  verified: boolean;
}

interface UserPairsData {
  pairs: UserPair[];
  dailyLimits: Record<string, { count: number; date: string }>;
}

function readUserPairs(): UserPairsData {
  try {
    if (!fs.existsSync(USER_PAIRS_FILE)) {
      return { pairs: [], dailyLimits: {} };
    }
    const data = fs.readFileSync(USER_PAIRS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading user pairs:', error);
    return { pairs: [], dailyLimits: {} };
  }
}

function writeUserPairs(data: UserPairsData) {
  try {
    const dir = path.dirname(USER_PAIRS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(USER_PAIRS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing user pairs:', error);
    throw error;
  }
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function checkDailyLimit(walletAddress: string, data: UserPairsData): boolean {
  const today = getTodayString();
  const limit = data.dailyLimits[walletAddress.toLowerCase()];
  
  if (!limit || limit.date !== today) {
    return true; // No limit or old date, can add
  }
  
  return limit.count < DAILY_LIMIT;
}

function incrementDailyLimit(walletAddress: string, data: UserPairsData) {
  const today = getTodayString();
  const address = walletAddress.toLowerCase();
  
  if (!data.dailyLimits[address] || data.dailyLimits[address].date !== today) {
    data.dailyLimits[address] = { count: 1, date: today };
  } else {
    data.dailyLimits[address].count += 1;
  }
}

// GET: Retrieve all pairs or user's pairs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('address');
    
    const data = readUserPairs();
    
    if (walletAddress) {
      // Return only this user's pairs
      const userPairs = data.pairs.filter(
        p => p.walletAddress.toLowerCase() === walletAddress.toLowerCase()
      );
      const today = getTodayString();
      const limit = data.dailyLimits[walletAddress.toLowerCase()];
      const remaining = limit && limit.date === today ? DAILY_LIMIT - limit.count : DAILY_LIMIT;
      
      return NextResponse.json({ 
        pairs: userPairs,
        remainingToday: Math.max(0, remaining),
        dailyLimit: DAILY_LIMIT
      });
    }
    
    // Return all pairs
    return NextResponse.json({ pairs: data.pairs });
  } catch (error) {
    console.error('Error in GET /api/pairs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pairs' },
      { status: 500 }
    );
  }
}

// POST: Add a new pair
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      walletAddress,
      baseToken,
      quoteToken,
      feed,
      network,
      signature,
      message,
    } = body;

    // Validate required fields
    if (!walletAddress || !baseToken || !quoteToken || !feed || !network || !signature || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify signature
    try {
      const isValid = await verifyMessage({
        address: walletAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    } catch (error) {
      console.error('Signature verification error:', error);
      return NextResponse.json(
        { error: 'Signature verification failed' },
        { status: 401 }
      );
    }

    const data = readUserPairs();

    // Check daily limit
    if (!checkDailyLimit(walletAddress, data)) {
      return NextResponse.json(
        { error: `Daily limit of ${DAILY_LIMIT} pairs reached. Try again tomorrow.` },
        { status: 429 }
      );
    }

    // Create pair ID
    const pairId = `${baseToken}-${quoteToken}`;

    // Check if pair already exists
    const existingPair = data.pairs.find(
      p => p.pairId.toLowerCase() === pairId.toLowerCase()
    );

    if (existingPair) {
      return NextResponse.json(
        { error: 'This pair already exists' },
        { status: 409 }
      );
    }

    // Determine RPC URL based on network
    const rpcUrl = network === 'somnia' 
      ? 'https://dream-rpc.somnia.network'
      : 'https://eth.llamarpc.com';

    // Create new pair
    const newPair: UserPair = {
      id: `${Date.now()}-${walletAddress}`,
      walletAddress: walletAddress.toLowerCase(),
      baseToken,
      quoteToken,
      pairId,
      feed,
      network,
      rpcUrl,
      addedAt: Date.now(),
      verified: false, // Will be verified when first price update runs
    };

    data.pairs.push(newPair);
    incrementDailyLimit(walletAddress, data);
    writeUserPairs(data);

    return NextResponse.json({
      success: true,
      pair: newPair,
      message: 'Pair added successfully! It will appear in the dashboard after the next update cycle.',
    });
  } catch (error) {
    console.error('Error in POST /api/pairs:', error);
    return NextResponse.json(
      { error: 'Failed to add pair' },
      { status: 500 }
    );
  }
}

// DELETE: Remove a pair (only by owner)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pairId = searchParams.get('id');
    const walletAddress = searchParams.get('address');
    const signature = searchParams.get('signature');
    const message = searchParams.get('message');

    if (!pairId || !walletAddress || !signature || !message) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Verify signature
    try {
      const isValid = await verifyMessage({
        address: walletAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Signature verification failed' },
        { status: 401 }
      );
    }

    const data = readUserPairs();
    const pairIndex = data.pairs.findIndex(p => p.id === pairId);

    if (pairIndex === -1) {
      return NextResponse.json(
        { error: 'Pair not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (data.pairs[pairIndex].walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'You can only delete your own pairs' },
        { status: 403 }
      );
    }

    data.pairs.splice(pairIndex, 1);
    writeUserPairs(data);

    return NextResponse.json({
      success: true,
      message: 'Pair deleted successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/pairs:', error);
    return NextResponse.json(
      { error: 'Failed to delete pair' },
      { status: 500 }
    );
  }
}
