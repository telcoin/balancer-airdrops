import fetch from "cross-fetch";
import { AlchemyTransfersParameters, AlchemyTransfersResponse, Param, Transfer } from "./types";

const KEY = process.env.ALCHEMYKEY;
const APIURL = "https://polygon-mainnet.g.alchemy.com/v2/" + KEY;

function wait(t: number) {
    return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, t);
    });
}

async function getLastBlockNum(): Promise<number> {
    const body = {
        "jsonrpc":"2.0",
        "method":"eth_blockNumber",
        "params":[],
        "id":0
    };
    const opts = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        redirect: "follow"
    } as RequestInit;

    const response = await fetch(APIURL, opts);

    return Number((await response.json()).result);
}

export async function getTransfers(erc20Address: string, startblock: number, endBlock: number, additionalOptions: Param = {}): Promise<Transfer[]> {
    if (endBlock === -1) {
        endBlock = await getLastBlockNum();
    }
    
    const body = {
        "jsonrpc": "2.0",
        "id": 0,
        "method": "alchemy_getAssetTransfers",
        "params": [
            {
                "fromBlock": '0x' + startblock.toString(16),
                "toBlock": '0x' + (endBlock).toString(16),
                //   "fromAddress": "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE",
                "contractAddresses": [erc20Address],
                // "maxCount": "0x5",
                "excludeZeroValue": true,
                "category": ["erc20"]
            }
        ]
    } as AlchemyTransfersParameters;

    body.params[0] = Object.assign(body.params[0], additionalOptions);

    let ans: Transfer[] = [];

    while (true) {
        const opts = {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            redirect: "follow"
        } as RequestInit;

        const response = await fetch(APIURL, opts);
        const resJson = await response.json() as AlchemyTransfersResponse;
        // console.log(resJson);
        resJson.result.transfers.forEach(tx => {
            tx.from = tx.from.toLowerCase();
            tx.to = tx.to.toLowerCase();
            tx.rawContract.address = tx.rawContract.address.toLowerCase();
            ans.push(tx);
        })

        if (resJson.result.pageKey === undefined) {
            return ans;
        }
        
        body.params[0].pageKey = resJson.result.pageKey;
    }
}

export async function getTransfersOfPools(erc20Addresses: string[], startBlock: number, endBlock: number): Promise<{[key: string]: Transfer[]}> {
    const ans: {[key: string]: Transfer[]} = {};

    for (let i = 0; i < erc20Addresses.length; i++) {
        ans[erc20Addresses[i]] = await getTransfers(erc20Addresses[i], startBlock, endBlock);
    }

    return ans;
}

export async function getTimestampOfBlock(block: number): Promise<number> {
    const body = {
        "jsonrpc": "2.0",
        "id": 0,
        "method": "eth_getBlockByNumber",
        "params": [
            '0x' + block.toString(16),
            false
        ]
    };

    const opts = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        redirect: "follow"
    } as RequestInit;

    const response = await fetch(APIURL, opts);
    const resJson = await response.json();
    try {
        return Number(resJson.result.timestamp);
    }
    catch (e) {
        if (resJson.error !== undefined && resJson.error.code == 429) {
            console.log(429);
            await wait(1000);
            return getTimestampOfBlock(block);
        }
        
        throw e;
    }
}

export async function getTimestampsOfBlocks(blocks: number[]): Promise<{[key: number]: number}> {
    const batchSize = 10;
    const out: {[key: number]: number} = {};

    for (let i = 0; i < blocks.length; i += batchSize) {
        const thisBatch = blocks.slice(i, i + batchSize);
        const answer = await Promise.all(thisBatch.map(b => getTimestampOfBlock(b)));
        for (let j = 0; j < thisBatch.length; j++) {
            out[thisBatch[j]] = answer[j];
        }
        console.log(i,blocks.length);
    }

    return out;
}