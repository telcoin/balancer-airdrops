import { ethers } from "ethers";

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export class FakeStaking {
    rewardPerTokenStored: ethers.BigNumber                      = ethers.BigNumber.from(0);
    totalSupply: ethers.BigNumber                               = ethers.BigNumber.from(0);
    balances: {[key: string]: ethers.BigNumber}                 = {};
    userRewardPerTokenPaid: {[key: string]: ethers.BigNumber}   = {};
    rewards: {[key: string]: ethers.BigNumber}                  = {};
    rewardRate: ethers.BigNumber                                = ethers.BigNumber.from(0);
    lastUpdateTime: ethers.BigNumber                            = ethers.BigNumber.from(0);
    periodFinish: ethers.BigNumber                              = ethers.BigNumber.from(0);
    rewardsDuration: ethers.BigNumber                           = ethers.BigNumber.from(0);

    solRequire(condition: boolean, err: string) {
        if (!condition) throw new Error(err);
    }
    
    lastTimeRewardApplicable(ts: number) {
        // return ethers.BigNumber.from(ts); // TODO
        return ethers.BigNumber.from(Math.min(ts, Number(this.periodFinish)));
    }
    
    rewardPerToken(ts: number): ethers.BigNumber {
        if (this.totalSupply.eq(0)) {
            return this.rewardPerTokenStored;
        }
        if (this.lastTimeRewardApplicable(ts).lt(this.lastUpdateTime)) {
            throw new Error('eee');
        }
        return this.rewardPerTokenStored.add(
            this.lastTimeRewardApplicable(ts).sub(this.lastUpdateTime).mul(this.rewardRate).mul(1e18+'').div(this.totalSupply)
        );
    }
    
    earned(account: string, ts: number) {
        // return (_balances[account]*(rewardPerToken() - (userRewardPerTokenPaid[account]))/(1e18)) + (rewards[account]);
        this.balances[account] = ethers.BigNumber.from(this.balances[account] || 0);
        this.userRewardPerTokenPaid[account] = ethers.BigNumber.from(this.userRewardPerTokenPaid[account] || 0);
        this.rewards[account] = ethers.BigNumber.from(this.rewards[account] || 0);
        return (this.balances[account]).mul(this.rewardPerToken(ts).sub(this.userRewardPerTokenPaid[account])).div(1e18+'').add(this.rewards[account]);
    }
    
    stake(account: string, amount: ethers.BigNumber, ts: number) {
        if (account === ZERO_ADDRESS) {
            console.log('how');
        }
        this.updateReward(account, ts);
    
        this.solRequire(amount.gt(0), "Cannot stake 0");
    
        this.totalSupply = this.totalSupply.add(amount);
        if (!this.balances[account]) this.balances[account] = ethers.BigNumber.from(0);
        this.balances[account] = this.balances[account].add(amount);
    }
    
    withdraw(account: string, amount: ethers.BigNumber, ts: number) {
        this.updateReward(account, ts);
        this.solRequire(amount.gt(0), "Cannot withdraw 0");
        this.totalSupply = this.totalSupply.sub(amount);
        this.balances[account] = this.balances[account].sub(amount);
        // _balances[account] = Math.max(_balances[account], 0);
    }
    
    updateReward(account: string, ts: number) {
        this.rewardPerTokenStored = this.rewardPerToken(ts);
        this.lastUpdateTime = this.lastTimeRewardApplicable(ts);
        if (account != ZERO_ADDRESS) {
            this.rewards[account] = this.earned(account, ts);
            this.userRewardPerTokenPaid[account] = this.rewardPerTokenStored;
        }
    }

    // owner functions

    notifyRewardAmount(reward: number, ts: number) {
        this.solRequire(this.rewardsDuration.gt(0), "rewards duration cannot be 0");
        
        if (ethers.BigNumber.from(ts) >= this.periodFinish) {
            this.rewardRate = ethers.BigNumber.from(reward).mul(1e18+'').div(this.rewardsDuration);
        }
        else {
            throw new Error("this should not happen");
        }


        this.lastUpdateTime = ethers.BigNumber.from(ts);
        this.periodFinish = ethers.BigNumber.from(ts).add(this.rewardsDuration);
    }

    setRewardsDuration(duration: number) {
        this.rewardsDuration = ethers.BigNumber.from(duration);
    }


    /*

    function setRewardsDuration(uint256 _rewardsDuration) external onlyOwner {
        require(
            block.timestamp > periodFinish,
            "Previous rewards period must be complete before changing the duration for the new period"
        );
        rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(rewardsDuration);
    }


    function notifyRewardAmount(uint256 reward) external onlyRewardsDistribution updateReward(address(0)) {
        if (block.timestamp >= periodFinish) {
            rewardRate = reward.div(rewardsDuration);
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(rewardRate);
            rewardRate = reward.add(leftover).div(rewardsDuration);
        }

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint balance = rewardsToken.balanceOf(address(this));
        require(rewardRate <= balance.div(rewardsDuration), "Provided reward too high");

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(rewardsDuration);
        emit RewardAdded(reward);
    }
    */
}