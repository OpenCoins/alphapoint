<template>
  <div class="app-container">
    <h1>Alpha Point</h1>
    <p>追踪BSC交易，实现零滑点交易</p>
    <div class="warning-message">
      使用此工具交易时必须取消勾选MEV保护，滑点可以调低到0.1%，目前仅支持PancakeSwap的交易
    </div>
    <button @click="connectWallet" class="connect-wallet-btn">连接钱包</button>

    <!-- 授权代币表单 -->
    <div v-if="accounts.length" class="token-authorization">
      <h3>授权代币</h3>
      <input v-model="tokenAddress" placeholder="代币地址" />
      <input v-model="spenderAddress" placeholder="Spender 地址" />
      <input v-model="approvalAmount" placeholder="授权金额 (默认最大值)" />
      <button @click="approveToken" class="authorize-btn">授权</button>
    </div>

    <!-- 后台交易配置 -->
    <div v-if="accounts.length" class="background-swap-config">
      <h3>后台交易配置</h3>
      <label for="triggerMode">选择触发方式：</label>
      <select v-model="triggerMode" id="triggerMode">
        <option value="manual">手动触发</option>
        <option value="polling">定时轮询（每10秒）</option>
        <option value="blockListener">区块监听</option>
        <option value="apiDriven">API 数据驱动</option>
      </select>
      <button @click="startBackgroundSwap" class="config-btn">启动后台交易</button>
      <button @click="stopBackgroundSwap" class="config-btn">停止后台交易</button>
    </div>

    <!-- 捆绑交易表单 -->
    <div v-if="accounts.length" class="swap-tokens">
      <h3>捆绑交易 (买入 + 卖出)</h3>
      <input v-model="buyTokenIn" placeholder="买入代币输入地址" />
      <input v-model="buyTokenOut" placeholder="买入代币输出地址" />
      <input v-model="buyAmountIn" placeholder="买入金额" />
      <input v-model="buyAmountOutMin" placeholder="最小买入产出（建议：{{ calculatedBuyMin }}）" />
      <input v-model="sellTokenIn" placeholder="卖出代币输入地址" />
      <input v-model="sellTokenOut" placeholder="卖出代币输出地址" />
      <input v-model="sellAmountIn" placeholder="卖出金额" />
      <input v-model="sellAmountOutMin" placeholder="最小卖出产出（建议：{{ calculatedSellMin }}）" />
      <button @click="swapTokens" class="swap-btn">执行捆绑交易</button>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>Pair</th>
          <th>Fee</th>
          <th>TVL</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>-</td>
          <td>0.01%</td>
          <td>$2.87M</td>
        </tr>
      </tbody>
    </table>

    <div class="token-authorization-status">
      <h3>代币授权状态</h3>
      <table>
        <thead>
          <tr>
            <th>代币状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(token, index) in tokens" :key="index">
            <td>{{ token.name }}</td>
            <td>
              <select v-model="token.status">
                <option value="未授权">未授权</option>
                <option value="已授权">已授权</option>
              </select>
            </td>
            <td><button @click="approveToken(token)" class="authorize-btn">授权</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="expiration-status">
      <h3>有效期状态</h3>
      <table>
        <thead>
          <tr>
            <th>地址</th>
            <th>有效期状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(address, index) in addresses" :key="index">
            <td>{{ address.value }}</td>
            <td>
              <select v-model="address.status">
                <option value="已过期">已过期</option>
                <option value="有效">有效</option>
              </select>
            </td>
            <td><button @click="renewAddress(address)" class="authorize-btn">续期</button></td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>

<script>
import Web3 from 'web3';  // 引入 web3 库

export default {
  data() {
    return {
      tokenAddress: '0xYourTokenAddress',  // 替换为实际的代币合约地址
      spenderAddress: '0xYourSpenderAddress',  // 替换为实际的spender地址
      approvalAmount: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',  // 默认最大值
      buyTokenIn: '',
      buyTokenOut: '',
      buyAmountIn: '',
      buyAmountOutMin: '',
      sellTokenIn: '',
      sellTokenOut: '',
      sellAmountIn: '',
      sellAmountOutMin: '',
      triggerMode: 'manual',  // 可选值：manual, polling, blockListener, apiDriven
      web3: null,
      accounts: [],
      pollingInterval: null,
      blockSubscription: null,
      tokens: [
        { name: 'B2', status: '未授权' }
      ],
      addresses: [
        { value: '0xYourAddress1', status: '有效' },
        { value: '0xYourAddress2', status: '已过期' }
      ]
    };
  },
  methods: {
    async connectWallet() {
      if (window.ethereum) {
        try {
          // 请求用户授权访问其MetaMask账户
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          this.accounts = accounts;
          console.log('Connected account:', accounts[0]);
        } catch (error) {
          console.error('User denied account access...', error);
        }
      } else {
        console.error('MetaMask not detected');
      }
    },
    async approveToken(token) {
      if (!this.web3 || !this.accounts.length) {
        console.error('请先连接您的钱包');
        return;
      }

      const contractAddress = this.tokenAddress;
      const spender = this.spenderAddress;
      const amount = this.approvalAmount === '' ? '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' : this.approvalAmount;

      const contract = new this.web3.eth.Contract(ABI, contractAddress);  // ABI 替换为实际的代币合约 ABI

      try {
        const tx = await contract.methods.approve(spender, amount).send({ from: this.accounts[0] });
        console.log('Approval successful:', tx);
      } catch (error) {
        console.error('Approval failed:', error);
      }
    },
    async swapTokens() {
      if (!this.web3 || !this.accounts.length) {
        console.error('请先连接您的钱包');
        return;
      }

      const pathBuy = [this.buyTokenIn, this.buyTokenOut];
      const pathSell = [this.sellTokenIn, this.sellTokenOut];

      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20分钟

      const pancakeRouterAddress = '0x10ED43C718714eb63d5aA57B78B54704E256024E'; // PancakeSwap Router V2 地址
      const pancakeRouterAbi = [ /* PancakeSwap Router V2 ABI */ ];

      const routerContract = new this.web3.eth.Contract(pancakeRouterAbi, pancakeRouterAddress);

      try {
        // 构造买入交易
        const buyTx = await routerContract.methods.swapExactTokensForTokens(
          this.buyAmountIn,
          this.buyAmountOutMin,
          pathBuy,
          this.accounts[0],
          deadline
        ).encodeABI();

        // 构造卖出交易
        const sellTx = await routerContract.methods.swapExactTokensForTokens(
          this.sellAmountIn,
          this.sellAmountOutMin,
          pathSell,
          this.accounts[0],
          deadline
        ).encodeABI();

        // 发送捆绑交易
        const batchTransaction = [{
          to: pancakeRouterAddress,
          data: buyTx
        }, {
          to: pancakeRouterAddress,
          data: sellTx
        }];

        const transactionHash = await this.web3.eth.sendTransaction({
          from: this.accounts[0],
          to: pancakeRouterAddress,
          data: batchTransaction
        });

        console.log('捆绑交易成功:', transactionHash);
      } catch (error) {
        console.error('捆绑交易失败:', error);
      }
    },
    async startBackgroundSwap() {
      if (this.pollingInterval || this.blockSubscription) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
        if (this.blockSubscription) {
          await this.blockSubscription.unsubscribe();
          this.blockSubscription = null;
        }
      }

      switch (this.triggerMode) {
        case 'polling':
          this.pollingInterval = setInterval(async () => {
            await this.checkAndSwapTokens();
          }, 10000);
          console.log('已启动定时轮询交易模式');
          break;
        case 'blockListener':
          this.blockSubscription = this.web3.eth.subscribe('newBlockHeaders', async (error, blockHeader) => {
            if (!error) {
              await this.checkAndSwapTokens();
            }
          });
          console.log('已启动区块监听交易模式');
          break;
        case 'apiDriven':
          // 模拟从 API 获取滑点信息
          const response = await fetch('https://your-api.com/slippage');
          const data = await response.json();
          if (data.slippage < 1.0) {
            await this.swapTokens();
          }
          break;
        case 'manual':
        default:
          console.log('当前为手动触发模式');
          break;
      }
    },
    async stopBackgroundSwap() {
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }
      if (this.blockSubscription) {
        await this.blockSubscription.unsubscribe();
        this.blockSubscription = null;
      }
      console.log('后台交易已停止');
    },
    async checkAndSwapTokens() {
      // 示例逻辑：滑点小于 1% 时返回 true
      const slippage = this.calculateSlippage();
      if (slippage < 1.0 && this.accounts.length) {
        await this.swapTokens();
      }
    },
    calculateSlippage() {
      // 示例逻辑：根据当前价格和预期价格计算滑点
      const expectedPrice = 1.0;
      const actualPrice = 0.995;
      return ((expectedPrice - actualPrice) / expectedPrice) * 100;
    },
    async renewAddress(address) {
      // 模拟续期操作
      console.log('续期地址:', address.value);
    }
  },
  async mounted() {
    if (window.ethereum) {
      this.web3 = new Web3(window.ethereum);
      this.accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    } else {
      console.error('MetaMask not detected');
    }
  }
};
</script>

<style scoped>
.app-container {
  text-align: center;
  color: white;
}

.warning-message {
  background-color: #333;
  border-left: 4px solid orange;
  padding: 10px;
  margin: 20px 0;
}

.connect-wallet-btn {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
  margin-top: 20px;
}

.data-table {
  width: 100%;
  margin-top: 20px;
  border-collapse: collapse;
}

.data-table th, .data-table td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

.data-table th {
  background-color: #f2f2f2;
}

.authorize-btn {
  background-color: #28a745;
  color: white;
  border: none;
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
  margin-top: 20px;
}

.token-authorization, .swap-tokens, .background-swap-config {
  margin-top: 30px;
}

input {
  display: block;
  margin: 10px auto;
  padding: 10px;
  width: 300px;
  border-radius: 4px;
  border: 1px solid #ccc;
}

.swap-btn {
  background-color: #dc3545;
  color: white;
  border: none;
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
  margin-top: 20px;
}

.config-btn {
  background-color: #ffc107;
  color: black;
  border: none;
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
  margin-top: 10px;
  margin-right: 10px;
}
</style>