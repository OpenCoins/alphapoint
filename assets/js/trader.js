// 零滑点交易工具的前端接口

class ZeroSlippageTrader {
    constructor() {
        // PancakeSwap Router地址 (BSC主网)
        this.routerAddress = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
        
        // 合约地址 (部署后需要更新)
        this.contractAddress = '0x123456789abcdef123456789abcdef123456789a'; // 示例地址，实际部署后需要替换
        
        // 合约ABI
        this.contractABI = [
            // 只包含我们需要使用的函数
            "function approveToken(address token, uint256 amount) external",
            "function checkTokenAllowance(address token) external view returns (uint256)",
            "function executeTrade(uint256 amountIn, uint256 amountOutMin, address[] calldata path, uint256 deadline) external",
            "function executeBatchTrade(address[] calldata buyPath, address[] calldata sellPath, uint256 buyAmountIn, uint256 sellAmountIn, uint256 maxSlippagePercent, uint256 deadline) external",
            "function withdrawToken(address token, uint256 amount) external",
            "function withdrawBNB(uint256 amount) external"
        ];
        
        // ERC20代币ABI
        this.tokenABI = [
            "function balanceOf(address account) external view returns (uint256)",
            "function approve(address spender, uint256 amount) external returns (bool)",
            "function allowance(address owner, address spender) external view returns (uint256)",
            "function decimals() external view returns (uint8)"
        ];
        
        this.web3 = null;
        this.contract = null;
        this.account = null;
        this.isConnected = false;
    }
    
    /**
     * 初始化Web3和合约
     */
    async init() {
        if (window.ethereum) {
            try {
                // 初始化Web3
                this.web3 = new Web3(window.ethereum);
                
                // 如果合约地址已设置，则初始化合约
                if (this.contractAddress) {
                    this.contract = new this.web3.eth.Contract(this.contractABI, this.contractAddress);
                }
                
                // 监听账户变化
                window.ethereum.on('accountsChanged', (accounts) => this.handleAccountsChanged(accounts));
                
                // 监听链变化
                window.ethereum.on('chainChanged', () => window.location.reload());
                
                return true;
            } catch (error) {
                console.error('初始化Web3失败:', error);
                return false;
            }
        } else {
            console.error('请安装MetaMask!');
            return false;
        }
    }
    
    /**
     * 连接钱包
     */
    async connectWallet() {
        if (!this.web3) {
            const initialized = await this.init();
            if (!initialized) return false;
        }
        
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            this.account = accounts[0];
            
            // 检查当前网络是否为BSC
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            if (chainId !== '0x38') { // BSC主网的chainId
                await this.switchToBSCNetwork();
            }
            
            this.isConnected = true;
            return this.account;
        } catch (error) {
            console.error('连接钱包失败:', error);
            return false;
        }
    }
    
    /**
     * 切换到BSC网络
     */
    async switchToBSCNetwork() {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x38' }], // BSC的chainId
            });
            return true;
        } catch (switchError) {
            // 如果网络不存在，则添加BSC网络
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [
                            {
                                chainId: '0x38',
                                chainName: 'Binance Smart Chain',
                                nativeCurrency: {
                                    name: 'BNB',
                                    symbol: 'BNB',
                                    decimals: 18,
                                },
                                rpcUrls: ['https://bsc-dataseed.binance.org/'],
                                blockExplorerUrls: ['https://bscscan.com/'],
                            },
                        ],
                    });
                    return true;
                } catch (addError) {
                    console.error('无法添加BSC网络:', addError);
                    return false;
                }
            } else {
                console.error('无法切换到BSC网络:', switchError);
                return false;
            }
        }
    }
    
    /**
     * 处理账户变化
     */
    handleAccountsChanged(accounts) {
        if (accounts.length === 0) {
            // 用户断开了钱包连接
            this.account = null;
            this.isConnected = false;
        } else {
            // 账户已更改
            this.account = accounts[0];
        }
    }
    
    /**
     * 设置合约地址
     */
    setContractAddress(address) {
        this.contractAddress = address;
        if (this.web3) {
            this.contract = new this.web3.eth.Contract(this.contractABI, this.contractAddress);
        }
    }
    
    /**
     * 检查代币授权状态
     * @param tokenAddress 代币地址
     * @param ownerAddress 所有者地址
     * @returns 授权数量
     */
    async checkTokenAllowance(tokenAddress, ownerAddress) {
        if (!this.isConnected || !this.contract) {
            throw new Error('钱包未连接或合约未初始化');
        }
        
        try {
            const tokenContract = new this.web3.eth.Contract(this.tokenABI, tokenAddress);
            // 检查对合约的授权，而不是对路由器的授权
            const allowance = await tokenContract.methods.allowance(ownerAddress, this.contractAddress).call();
            console.log(`代币 ${tokenAddress} 授权数量: ${allowance}`);
            return allowance;
        } catch (error) {
            console.error('检查代币授权失败:', error);
            throw error;
        }
    }
    
    /**
     * 授权代币
     * @param tokenAddress 代币地址
     * @param amount 授权数量
     */
    async approveToken(tokenAddress, amount) {
        if (!this.isConnected || !this.contract) {
            throw new Error('钱包未连接或合约未初始化');
        }
        
        try {
            // 创建代币合约实例
            const tokenContract = new this.web3.eth.Contract(this.tokenABI, tokenAddress);
            
            // 获取代币精度
            let decimals = 18; // 默认精度
            try {
                decimals = await tokenContract.methods.decimals().call();
            } catch (error) {
                console.warn('无法获取代币精度，使用默认值18:', error);
            }
            
            // 如果amount是字符串且不包含科学计数法，则转换为BigNumber
            let amountToApprove = amount;
            if (typeof amount === 'string' && !amount.includes('e')) {
                // 检查是否已经是Wei单位
                if (!amount.includes('.')) {
                    amountToApprove = amount;
                } else {
                    // 转换为Wei单位
                    const parts = amount.split('.');
                    const wholePart = parts[0];
                    let fractionalPart = parts[1] || '';
                    
                    // 补齐小数部分
                    while (fractionalPart.length < decimals) {
                        fractionalPart += '0';
                    }
                    
                    // 截断超出精度的部分
                    fractionalPart = fractionalPart.substring(0, decimals);
                    
                    amountToApprove = wholePart + fractionalPart;
                }
            }
            
            // 授权最大数量（无限授权）
            const maxUint256 = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
            
            // 执行授权
            const tx = await tokenContract.methods.approve(this.contractAddress, maxUint256).send({ from: this.account });
            console.log('代币授权成功:', tx);
            return tx;
        } catch (error) {
            console.error('授权代币失败:', error);
            throw error;
        }
    }
    
    /**
     * 执行单个交易
     */
    async executeTrade(amountIn, amountOutMin, path, deadline) {
        if (!this.isConnected || !this.contract) {
            throw new Error('钱包未连接或合约未初始化');
        }
        
        try {
            const tx = await this.contract.methods.executeTrade(amountIn, amountOutMin, path, deadline).send({ from: this.account });
            return tx;
        } catch (error) {
            console.error('执行交易失败:', error);
            throw error;
        }
    }
    
    /**
     * 执行批量交易（买卖同时进行，减少价格影响）
     * @param buyPath 买入路径
     * @param sellPath 卖出路径
     * @param buyAmountIn 买入数量
     * @param sellAmountIn 卖出数量
     * @param maxSlippagePercent 最大滑点百分比
     * @param deadline 交易截止时间
     */
    async executeBatchTrade(buyPath, sellPath, buyAmountIn, sellAmountIn, maxSlippagePercent, deadline) {
        if (!this.isConnected || !this.contract) {
            throw new Error('钱包未连接或合约未初始化');
        }
        
        try {
            // 检查代币授权状态
            const buyTokenAddress = buyPath[0];
            const sellTokenAddress = sellPath[0];
            
            // 检查买入代币授权
            const buyTokenAllowance = await this.checkTokenAllowance(buyTokenAddress, this.account);
            if (buyTokenAllowance < buyAmountIn) {
                // 如果授权不足，则授权代币
                await this.approveToken(buyTokenAddress, buyAmountIn);
            }
            
            // 检查卖出代币授权
            const sellTokenAllowance = await this.checkTokenAllowance(sellTokenAddress, this.account);
            if (sellTokenAllowance < sellAmountIn) {
                // 如果授权不足，则授权代币
                await this.approveToken(sellTokenAddress, sellAmountIn);
            }
            
            // 执行批量交易
            const tx = await this.contract.methods.executeBatchTrade(
                buyPath, 
                sellPath, 
                buyAmountIn, 
                sellAmountIn, 
                maxSlippagePercent, 
                deadline
            ).send({ from: this.account });
            
            return tx;
        } catch (error) {
            console.error('执行批量交易失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取代币余额
     */
    async getTokenBalance(tokenAddress, ownerAddress) {
        if (!this.web3) {
            throw new Error('Web3未初始化');
        }
        
        try {
            const tokenContract = new this.web3.eth.Contract(this.tokenABI, tokenAddress);
            const balance = await tokenContract.methods.balanceOf(ownerAddress).call();
            return balance;
        } catch (error) {
            console.error('获取代币余额失败:', error);
            throw error;
        }
    }
}

// 导出实例
const trader = new ZeroSlippageTrader();