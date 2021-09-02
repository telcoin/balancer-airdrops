const fetch = require('node-fetch');
const ethers = require('ethers');
const Web3 = require('web3');
const fs = require('fs');
const web3 = new Web3(new Web3.providers.HttpProvider("https://polygon-mainnet.infura.io/v3/25a04237edaa4aaebffda3c53ce4cf6d"));


const POLYGONSCAN_API_KEY = "IV7ZFBB1SH3DKM6QB3435K3X4XZF2NQECW";
const TEL_ADDRESS = "0xdf7837de1f2fa4631d716cf2502f8b230f1dcc32";

const POOL_NAME = "TEL60WETH20USDC20";
const SNAPSHOT_DURATION = 60*60*24; // 1 day

const POLYGONSCAN_API_DELAY = 200;


const STAKING_POOLS = {
    TEL60WMATIC20USDC20: {
        address: "0x6a28b74263EbA6b37C0b0c426f7Dee5173380200",
        stakingToken: "0xd208168d2a512240eb82582205d94a0710bce4e7",
        startBlock: 18136981,
        totalRewards: 3000000
    },
    TEL60AAVE20USDC20: {
        address: "0xEa18b906f2f4816eFe5B0cf2426883eAc8509185",
        stakingToken: "0x39cd55ff7e7d7c66d7d2736f1d5d4791cdab895b",
        startBlock: 18137000,
        totalRewards: 3000000
    },
    TEL60WBTC20USDC20: {
        address: "0x6D614fC4F47360C5C97e467b5Fad6b67E410E129",
        stakingToken: "0xf099b7c3bd5a221aa34cb83004a50d66b0189ad0",
        startBlock: 18137075,
        totalRewards: 3000000
    },
    TEL60BAL20USDC20: {
        address: "0x6125b540F4763E233224F4A22a7d3e7bF5C116F7",
        stakingToken: "0xdb1db6e248d7bb4175f6e5a382d0a03fe3dcc813",
        startBlock: 18136951,
        totalRewards: 4500000
    },
    TEL80USDC20: {
        address: "0x3F5B2375DD05bfC26Af6585852CC89603b597F2a",
        stakingToken: "0x5c6ee304399dbdb9c8ef030ab642b10820db8f56",
        startBlock: 18136686,
        totalRewards: 4500000
    },
    TEL50BAL50: {
        address: "0x2b33060a91b98Ed782676eBFB8C004126BC226a1",
        stakingToken: "0x186084ff790c65088ba694df11758fae4943ee9e",
        startBlock: 18136052,
        totalRewards: 4500000
    },
    TEL60WETH20USDC20: {
        address: "0x1F0Cd4e7D05A3f91378A460C6eb282217736Fb7a",
        stakingToken: "0xd5d7bc115b32ad1449c6d0083e43c87be95f2809",
        startBlock: 18135978,
        totalRewards: 3000000 
    },
};

const POOL = STAKING_POOLS[POOL_NAME];
const STAKING_POOL_CONTRACT = POOL.address;
const STAKING_LP_TOKEN = POOL.stakingToken;
const START_BLOCK = POOL.startBlock;
const TOTAL_REWARDS = POOL.totalRewards;

const REWARDS_DURATION = 3628800;


let rewardPerTokenStored = ethers.BigNumber.from(0);
let _totalSupply = ethers.BigNumber.from(0);
let _balances = {};
let userRewardPerTokenPaid = {};
let rewards = {};
let rewardRate = ethers.BigNumber.from(TOTAL_REWARDS).mul(1e18+'').div(REWARDS_DURATION);
let lastUpdateTime = -1;
let periodFinish = 999999999999999; // TODO (doesn't matter for now since the reward period is still going)

let _claimed = {};

function solRequire(condition, err) {
    if (!condition) throw new Error(err);
}

function lastTimeRewardApplicable(ts) {
    // return ethers.BigNumber.from(ts); // TODO
    return ethers.BigNumber.from(Math.min(ts, periodFinish));
}

function rewardPerToken(ts) {
    if (_totalSupply == 0) {
        return rewardPerTokenStored;
    }
    return rewardPerTokenStored.add(
        lastTimeRewardApplicable(ts).sub(lastUpdateTime).mul(rewardRate).mul(1e18+'').div(_totalSupply)
    );
}

function earned(account, ts) {
    // return (_balances[account]*(rewardPerToken() - (userRewardPerTokenPaid[account]))/(1e18)) + (rewards[account]);
    _balances[account] = ethers.BigNumber.from(_balances[account] || 0);
    userRewardPerTokenPaid[account] = ethers.BigNumber.from(userRewardPerTokenPaid[account] || 0);
    rewards[account] = ethers.BigNumber.from(rewards[account] || 0);
    return (_balances[account]).mul(rewardPerToken(ts).sub(userRewardPerTokenPaid[account])).div(1e18+'').add(rewards[account]);
}

function stake(account, amount, ts) {
    updateReward(account, ts);

    solRequire(amount > 0, "Cannot stake 0");

    _totalSupply = _totalSupply.add(amount);
    if (!_balances[account]) _balances[account] = ethers.BigNumber.from(0);
    _balances[account] = _balances[account].add(amount);
}

function withdraw(account, amount, ts) {
    updateReward(account, ts);
    solRequire(amount > 0, "Cannot withdraw 0");
    _totalSupply = _totalSupply.sub(amount);
    _balances[account] = _balances[account].sub(amount);
    // _balances[account] = Math.max(_balances[account], 0);
}

function updateReward(account, ts) {
    rewardPerTokenStored = rewardPerToken(ts);
    lastUpdateTime = ts;
    if (account != (0)) {
        rewards[account] = earned(account, ts);
        userRewardPerTokenPaid[account] = rewardPerTokenStored;
    }
}



const getERC20TransferEvents = async (
    erc20Address,
    startBlock = 0,
    endBlock = 9999999999999 // TODO: probably not ideal, though the end of the period should be accounted for in the "smart contract" logic anyway
) => {
    const URL = `https://api.polygonscan.com/api?module=account&action=tokentx&address=${erc20Address}&startblock=${startBlock}&endblock=${endBlock}&sort=asc&apikey=${POLYGONSCAN_API_KEY}`;

    const data = await fetch(URL).then((x) => x.json());

    return data.result;
};

function waitPromise(t) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, t);
    })
}

async function getBlock(bn) {
    let res = await fetch(`https://api.polygonscan.com/api?module=block&action=getblockreward&blockno=${bn}&apikey=${POLYGONSCAN_API_KEY}`);
    let json = await res.json();
    await waitPromise(POLYGONSCAN_API_DELAY);
    return json.result;
}

async function getBlockByTs(ts) {
    let res = await fetch(`https://api.polygonscan.com/api?module=block&action=getblocknobytime&timestamp=${ts - 0}&closest=before&apikey=${POLYGONSCAN_API_KEY}`);
    let json = await res.json();
    if (json.message != "OK") {
        return null;
    }
    await waitPromise(POLYGONSCAN_API_DELAY);
    return getBlock(json.result-0);
}

async function getTransactionsForAddress(address) {
    let res = await fetch(`https://api.polygonscan.com/api?module=account&action=txlist&address=${address}&startblock=0&endblock=999999999999&sort=desc&apikey=${POLYGONSCAN_API_KEY}`)
    return (await res.json()).result;
}

async function getContractInstance(address) {
    let res = await fetch(`https://api.polygonscan.com/api?module=contract&action=getabi&address=${address}`);
    let abi = (await res.json()).result;
    let MC = new web3.eth.Contract(JSON.parse(abi), address);
    return MC;
}

const OUTPUT = {snapshots: []};

async function takeSnapshot(endBlock, endTs) {
    console.log('snap ' + endBlock);
    const snap = {};
    const lastSnap = OUTPUT.snapshots[OUTPUT.snapshots.length - 1];
    if (OUTPUT.snapshots.length === 0) {
        // this is the first snapshot
        snap.startBlock = START_BLOCK;
        snap.startBlockTs = parseInt((await getBlock(START_BLOCK)).timeStamp);
    }
    else {
        snap.startBlock = lastSnap.endBlock;
        snap.startBlockTs = lastSnap.endBlockTs;
    }

    snap.endBlock = endBlock;
    snap.endBlockTs = endTs;

    snap.addresses = {};

    let addys = Object.keys(_balances);
    for (let i = 0; i < addys.length; i++) {
        const addy = addys[i];
        const thisAddyObj = {};
        thisAddyObj.balance = _balances[addy];
        thisAddyObj.totalEarned = earned(addy, endTs);
        thisAddyObj.earnedThisPeriod = thisAddyObj.totalEarned;

        thisAddyObj.totalClaimed =  ethers.BigNumber.from(_claimed[addy] || 0);
        thisAddyObj.claimedThisPeriod = thisAddyObj.totalClaimed;
        
        if (lastSnap && lastSnap.addresses[addy]) {
            thisAddyObj.earnedThisPeriod = thisAddyObj.earnedThisPeriod.sub(lastSnap.addresses[addy].totalEarned);
            thisAddyObj.claimedThisPeriod = thisAddyObj.claimedThisPeriod.sub(lastSnap.addresses[addy].totalClaimed);
        }

        Object.keys(thisAddyObj).forEach(k => {
            thisAddyObj[k] = thisAddyObj[k].toString();
        });

        snap.addresses[addy] = thisAddyObj;
    }

    OUTPUT.snapshots.push(snap);
}

(async () => {
    let startBlock = await getBlock(START_BLOCK);
    lastUpdateTime = ethers.BigNumber.from(startBlock.timeStamp);

    const events = await getERC20TransferEvents(STAKING_POOL_CONTRACT);

    const stakingPoolEvents = events.filter((x) => {
        return (
            ((x.from.toLowerCase() === STAKING_POOL_CONTRACT.toLowerCase() ||
                x.to.toLowerCase() === STAKING_POOL_CONTRACT.toLowerCase()) &&
            x.contractAddress.toLowerCase() === STAKING_LP_TOKEN.toLowerCase())
            // LP tokens moving
            ||
            // users claiming TEL
            (x.from.toLowerCase() === STAKING_POOL_CONTRACT.toLowerCase() && x.contractAddress.toLowerCase() === TEL_ADDRESS.toLowerCase())
        );
    });

    let currentSnapshotEndBlock = await getBlockByTs(startBlock.timeStamp - 0 + SNAPSHOT_DURATION);
    const topBlockNum = await web3.eth.getBlockNumber();
    const topBlockTs = Math.floor((new Date()-0)/1000);

    for (let i = 0; i < stakingPoolEvents.length; i++) {
        console.log('txn',i)
        const ev = stakingPoolEvents[i];
        if (ev.contractAddress.toLowerCase() === TEL_ADDRESS.toLowerCase()) {
            // claim
            _claimed[ev.to.toLowerCase()] = ethers.BigNumber.from(_claimed[ev.to.toLowerCase()] || 0).add(ethers.BigNumber.from(ev.value).mul(1e16+''));
        }
        else if (ev.to.toLowerCase() === STAKING_POOL_CONTRACT.toLowerCase()) {
            // deposit
            stake(ev.from.toLowerCase(), ethers.BigNumber.from(ev.value), ethers.BigNumber.from(ev.timeStamp));
        }
        else if (ev.from.toLowerCase() === STAKING_POOL_CONTRACT.toLowerCase()) {
            // withdrawal
            withdraw(ev.to.toLowerCase(), ethers.BigNumber.from(ev.value), ethers.BigNumber.from(ev.timeStamp));
        }

        // if (ev.from.toLowerCase() === "0x82945f1206be9be2cad555394dfc8191ed88d12c".toLowerCase() || ev.to.toLowerCase() === "0x82945f1206be9be2cad555394dfc8191ed88d12c".toLowerCase()) {
        //     console.log(ev);
        // }

        // if (i === stakingPoolEvents.length - 1) {
        //     // while topBlockNum is after the current snapshot period, take snapshot and move forward (snapEndBlock will be null for final snapshot)
            
        // }
        while (currentSnapshotEndBlock && i + 1 < stakingPoolEvents.length && stakingPoolEvents[i+1].blockNumber - 0 > currentSnapshotEndBlock.blockNumber - 0) {
            // while ev[i+1] is after the current snapshot period, take snapshot and move forward
            await takeSnapshot(currentSnapshotEndBlock.blockNumber - 0, currentSnapshotEndBlock.timeStamp - 0);
            currentSnapshotEndBlock = await getBlockByTs(currentSnapshotEndBlock.timeStamp - 0 + SNAPSHOT_DURATION);
        }
    }

    console.log("Finished processing transactions");

    while (currentSnapshotEndBlock != null) {
        console.log(currentSnapshotEndBlock);
        await takeSnapshot(currentSnapshotEndBlock.blockNumber - 0, currentSnapshotEndBlock.timeStamp - 0);
        currentSnapshotEndBlock = await getBlockByTs(currentSnapshotEndBlock - 0 + SNAPSHOT_DURATION);
    }
    await takeSnapshot(topBlockNum, topBlockTs);

    const stakingContractInstance = await getContractInstance(STAKING_POOL_CONTRACT);

    const addys = Object.keys(_balances);

    // create final state object

    console.log('Creating final state');

    const finalState = {};
    
    for (let i = 0; i < addys.length; i++) {
        const addy = addys[i];
        finalState[addy] = {
            balance: _balances[addy].toString(),
            totalEarned: earned(addy, ethers.BigNumber.from(topBlockTs)).toString(),
            totalClaimed: ethers.BigNumber.from(_claimed[addy] || 0).toString(),
            rewardPending: ethers.BigNumber.from(await stakingContractInstance.methods.earned(addy).call()).mul(1e16+'').toString()
        };
    }
    OUTPUT.finalState = finalState;

    fs.writeFileSync(`./${POOL_NAME}.json`, JSON.stringify(OUTPUT, null, 4));
})();
