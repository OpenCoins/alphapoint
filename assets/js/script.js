// DOM元素加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 模拟数据
    const mockTradeData = [
        { hash: '0x7a69c2d5b84a0e1554d0e9826c163f21876d0d00b9e8fd2f52bc8b8f4c5c8f9a', fee: '0.01 BNB', time: '2024-05-01 14:23:45' },
        { hash: '0x8b7a1d3e6f5c4b2a9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5', fee: '0.008 BNB', time: '2024-05-01 13:45:12' },
        { hash: '0x9c8b7a6d5e4f3c2b1a0d9e8f7c6b5a4d3e2f1c0b9a8d7e6f5c4b3a2d1e0f9c8b7', fee: '0.015 BNB', time: '2024-05-01 12:30:56' },
        { hash: '0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3', fee: '0.005 BNB', time: '2024-05-01 11:15:23' },
        { hash: '0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4', fee: '0.012 BNB', time: '2024-05-01 10:05:47' }
    ];

    // 初始化函数
    function init() {
        setupEventListeners();
        loadTradeData();
        simulateLoading();
    }

    // 设置事件监听器
    function setupEventListeners() {
        // 授权按钮点击事件
        const authButtons = document.querySelectorAll('.auth-btn');
        authButtons.forEach(button => {
            button.addEventListener('click', handleAuth);
        });

        // 续期按钮点击事件
        const renewButtons = document.querySelectorAll('.renew-btn');
        renewButtons.forEach(button => {
            button.addEventListener('click', handleRenew);
        });

        // 添加连接钱包按钮（如果需要）
        addWalletConnectButton();
    }

    // 添加连接钱包按钮
    function addWalletConnectButton() {
        const header = document.querySelector('header');
        const connectButton = document.createElement('button');
        connectButton.className = 'connect-wallet-btn';
        connectButton.textContent = '连接钱包';
        connectButton.addEventListener('click', connectWallet);
        header.appendChild(connectButton);
    }

    // 连接钱包功能
    async function connectWallet() {
        const button = document.querySelector('.connect-wallet-btn');
        button.textContent = '连接中...';
        button.disabled = true;

        try {
            // 检查是否安装了MetaMask
            if (typeof window.ethereum === 'undefined') {
                throw new Error('请安装MetaMask钱包');
            }

            // 请求连接钱包
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            
            // 检查当前网络是否为BSC
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            
            // BSC主网的chainId为0x38 (十进制56)
            if (chainId !== '0x38') {
                await switchToBSCNetwork();
            }
            
            // 获取钱包地址并显示
            const walletAddress = accounts[0];
            const shortAddress = walletAddress.substr(0, 6) + '...' + walletAddress.substr(-4);
            button.textContent = shortAddress;
            button.disabled = false;

            // 显示通知
            showNotification('BSC钱包连接成功！', 'success');

            // 更新UI状态
            updateUIAfterConnect();
            
            // 监听账户变化
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            // 监听链变化
            window.ethereum.on('chainChanged', handleChainChanged);
            
        } catch (error) {
            console.error('连接钱包失败:', error);
            button.textContent = '连接钱包';
            button.disabled = false;
            showNotification('连接钱包失败: ' + error.message, 'error');
        }
    }
    
    // 切换到BSC网络
    async function switchToBSCNetwork() {
        try {
            // 尝试切换到BSC网络
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x38' }], // BSC的chainId
            });
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
                } catch (addError) {
                    throw new Error('无法添加BSC网络: ' + addError.message);
                }
            } else {
                throw new Error('无法切换到BSC网络: ' + switchError.message);
            }
        }
    }
    
    // 处理账户变化
    function handleAccountsChanged(accounts) {
        if (accounts.length === 0) {
            // 用户断开了钱包连接
            const button = document.querySelector('.connect-wallet-btn');
            button.textContent = '连接钱包';
            showNotification('钱包已断开连接', 'info');
        } else {
            // 账户已更改
            const walletAddress = accounts[0];
            const shortAddress = walletAddress.substr(0, 6) + '...' + walletAddress.substr(-4);
            const button = document.querySelector('.connect-wallet-btn');
            button.textContent = shortAddress;
            showNotification('钱包账户已更改', 'info');
        }
    }
    
    // 处理链变化
    function handleChainChanged(chainId) {
        // 当链变化时，刷新页面
        if (chainId !== '0x38') {
            showNotification('请切换到BSC网络', 'error');
        } else {
            showNotification('已连接到BSC网络', 'success');
        }
    }

    // 连接钱包后更新UI
    function updateUIAfterConnect() {
        // 启用授权和续期按钮
        document.querySelectorAll('.auth-btn, .renew-btn').forEach(btn => {
            btn.disabled = false;
        });

        // 更新统计面板
        const statItems = document.querySelectorAll('.stat-item p');
        statItems[0].textContent = 'WBNB/BUSD';
    }

    // 处理授权按钮点击
    function handleAuth(event) {
        const button = event.target;
        const tokenElement = button.closest('.token');
        const statusElement = tokenElement.querySelector('.token-status-value');

        button.textContent = '授权中...';
        button.disabled = true;

        // 模拟授权过程
        setTimeout(() => {
            statusElement.textContent = '已授权';
            statusElement.style.color = '#238636';
            button.textContent = '已授权';
            button.style.backgroundColor = '#238636';
            button.disabled = true;

            showNotification('代币授权成功！', 'success');
        }, 2000);
    }

    // 处理续期按钮点击
    function handleRenew(event) {
        const button = event.target;
        const addressElement = button.closest('.address');
        const statusElement = addressElement.querySelector('.address-status-value');

        button.textContent = '续期中...';
        button.disabled = true;

        // 模拟续期过程
        setTimeout(() => {
            statusElement.textContent = '有效期: 30天';
            statusElement.style.color = '#238636';
            button.textContent = '已续期';
            button.style.backgroundColor = '#238636';
            button.disabled = true;

            showNotification('地址续期成功！', 'success');
        }, 2000);
    }

    // 加载交易数据
    function loadTradeData() {
        const tableBody = document.querySelector('.trade-table tbody');
        tableBody.innerHTML = '';

        mockTradeData.forEach(trade => {
            const row = document.createElement('tr');
            
            // 交易哈希列
            const hashCell = document.createElement('td');
            const shortHash = trade.hash.substr(0, 6) + '...' + trade.hash.substr(-4);
            hashCell.textContent = shortHash;
            hashCell.title = trade.hash; // 完整哈希显示为提示
            row.appendChild(hashCell);
            
            // 费用列
            const feeCell = document.createElement('td');
            feeCell.textContent = trade.fee;
            row.appendChild(feeCell);
            
            // 时间列
            const timeCell = document.createElement('td');
            timeCell.textContent = trade.time;
            row.appendChild(timeCell);
            
            tableBody.appendChild(row);
        });
    }

    // 模拟加载过程
    function simulateLoading() {
        const loadingElement = document.querySelector('.loading');
        
        setTimeout(() => {
            // 创建交易统计内容
            const statsContent = document.createElement('div');
            statsContent.className = 'trade-stats-content';
            statsContent.innerHTML = `
                <div class="stat-row">
                    <div class="stat-label">总交易量:</div>
                    <div class="stat-value">$1,245,678</div>
                </div>
                <div class="stat-row">
                    <div class="stat-label">交易次数:</div>
                    <div class="stat-value">42</div>
                </div>
                <div class="stat-row">
                    <div class="stat-label">平均滑点:</div>
                    <div class="stat-value">0.01%</div>
                </div>
                <div class="stat-row">
                    <div class="stat-label">节省费用:</div>
                    <div class="stat-value">$3,456</div>
                </div>
            `;
            
            // 替换加载元素
            loadingElement.parentNode.replaceChild(statsContent, loadingElement);
        }, 1500);
    }

    // 显示通知
    function showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 自动移除通知
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // 初始化应用
    init();
});