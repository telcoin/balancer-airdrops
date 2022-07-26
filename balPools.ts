import * as dotenv from 'dotenv';
import { ethers } from 'ethers';
import * as fs from 'fs';

dotenv.config();

import { getTimestampsOfBlocks, getTransfers } from './api/alchemy';
import { getWeekEndTimestamp, getWeekStartTimestamp } from './helpers/bal-weeks';
import { FakeStaking } from './helpers/fakeStakingContract';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const TEL_ADDRESS = '0xdF7837DE1F2Fa4631D716CF2502f8b230F1dcc32'.toLowerCase();
const WEEK = 112;
const START_TIMESTAMP = getWeekStartTimestamp(WEEK);
const END_TIMESTAMP = getWeekEndTimestamp(WEEK);

type Pool = {
    name: string;
    address: string;
    gauge: string;
    reward: number;
};

type Report = {[key: string]: ethers.BigNumber};

const POOLS: {[key: string]: Pool} = {
    TEL60BAL20USDC20: {
        name: "TEL60BAL20USDC20",
        address: "0xdb1db6e248d7bb4175f6e5a382d0a03fe3dcc813".toLowerCase(),
        gauge: "0xf2208B955E63855119a27A69A2EC38E0C8813AB3".toLowerCase(),
        reward: 1666666/2
    },
    TEL50BAL50: {
        name: "TEL50BAL50",
        address: "0x186084ff790c65088ba694df11758fae4943ee9e".toLowerCase(),
        gauge: "0x18253D36dC242BA720975e0D279683A0Cb183936".toLowerCase(),
        reward: 1666666/2
    }
};

async function createReportForPool(pool: Pool): Promise<Report> {        
    const fakeStaking = new FakeStaking();
    const topBlockTs = Math.floor((new Date().getTime()/1000));

    if (topBlockTs < END_TIMESTAMP) {
        console.warn(`WARNING: week ${WEEK} has not yet finished`);
    }

    console.log(`calculating week ${WEEK} for ${pool.name}`);

    // get erc20 transfers
    console.log('fetching transfers');
    const transfers = await getTransfers(pool.address, 0, -1);
    const blockNumbers = Array.from(new Set(transfers.map(tx => Number(tx.blockNum))));

    console.log('fetching block timestamps');
    const blockToTimestamp = await getTimestampsOfBlocks(blockNumbers);

    console.log('done fetching data');

    for (let i = 0; i < transfers.length; i++) {
        // somewhere in this loop we have to turn on the staking contract by calling owner methods
        const tx = transfers[i];
        const timestamp = blockToTimestamp[Number(tx.blockNum)];
        const value = ethers.BigNumber.from(tx.rawContract.value);

        if (timestamp >= START_TIMESTAMP && fakeStaking.lastUpdateTime.eq(0)) {
            // it's time to turn on rewards
            fakeStaking.setRewardsDuration(END_TIMESTAMP - START_TIMESTAMP);
            fakeStaking.notifyRewardAmount(pool.reward, START_TIMESTAMP);
        }

        if (tx.from === ZERO_ADDRESS && tx.to === ZERO_ADDRESS) {
            continue;
        }

        if (tx.from === pool.gauge && tx.to === ZERO_ADDRESS) {
            console.log(tx);
            throw new Error("this cannot happen, otherwise script will not work right");
        }

        if (tx.from === ZERO_ADDRESS) {
            // this is a mint
            // treat it as a stake
            fakeStaking.stake(tx.to, value, timestamp);
        }
        else if (tx.to === ZERO_ADDRESS) {
            // this is a burn
            // treat as a withdraw
            fakeStaking.withdraw(tx.from, value, timestamp);
        }
        else if (tx.to === pool.gauge || tx.from === pool.gauge) {
            // this is staking or unstaking in gauge
            // treat as nothing
        }
        else {
            // this is a transfer that isn't to/from the gauge
            // treat as withdraw by sender, stake by receiver
            fakeStaking.withdraw(tx.from, value, timestamp);
            fakeStaking.stake(tx.to, value, timestamp);
        }
    }

    // testing
    // let totalEarned = ethers.BigNumber.from(0);
    
    // Object.keys(fakeStaking.balances).forEach(addy => {
    //     totalEarned = totalEarned.add(fakeStaking.earned(addy, topBlockTs));
    // });

    // console.log(Number(totalEarned)/1e18);
    let report: Report = {};
    Object.keys(fakeStaking.balances).forEach(addy => {
        report[addy] = fakeStaking.earned(addy, topBlockTs);
    });
    return report;
}


function reportToCsvString(report: Report): string {
    let ans = '';
    Object.keys(report).forEach(addy => {
        let amt = Number(report[addy].div(1e16+''))/100;
        if (amt > 0) {
            // token_type,token_address,receiver,amount
            ans += `erc20,${TEL_ADDRESS},${addy},${amt}\n`;
        }
    });
    return ans;
}

(async () => {
    const finalReport: Report = {};
    const poolNames = Object.keys(POOLS);
    for (let i = 0; i < poolNames.length; i++) {
        const poolReport = await createReportForPool(POOLS[poolNames[i]]);
        Object.keys(poolReport).forEach(addy => {
            if (finalReport[addy] === undefined) {
                finalReport[addy] = ethers.BigNumber.from(0);
            }
            finalReport[addy] = finalReport[addy].add(poolReport[addy]);
        });
    }

    let t=ethers.BigNumber.from(0);
    Object.values(finalReport).forEach(v => {
        t = t.add(v.div(1e16+''));
    });
    console.log(Number(t))

    fs.writeFileSync(`./reports/${WEEK}.csv`, reportToCsvString(finalReport));
})();
