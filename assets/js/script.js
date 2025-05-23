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
        initTrader();
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

        // 连接钱包按钮点击事件
        const connectButton = document.querySelector('.connect-wallet-btn');
        if (connectButton) {
            connectButton.addEventListener('click', connectWallet);
        }

        // 代币授权按钮点击事件
        const approveTokenButton = document.getElementById('approve-token-btn');
        if (approveTokenButton) {
            approveTokenButton.addEventListener('click', approveToken);
        }

        // 执行批量交易按钮点击事件
        const executeBatchTradeButton = document.getElementById('execute-batch-trade-btn');
        if (executeBatchTradeButton) {
            executeBatchTradeButton.addEventListener('click', executeBatchTrade);
        }
    }

    // 初始化交易工具
    async function initTrader() {
        try {
            await trader.init();
            console.log('交易工具初始化成功');
        } catch (error) {
            console.error('交易工具初始化失败:', error);
            showNotification('交易工具初始化失败，请刷新页面重试', 'error');
        }
    }

    // 连接钱包功能
    async function connectWallet() {
        const button = document.querySelector('.connect-wallet-btn');
        button.textContent = '连接中...';
        button.disabled = true;

        try {
            // 使用trader.js中的连接钱包功能
            const account = await trader.connectWallet();
            
            if (account) {
                const shortAddress = account.substr(0, 6) + '...' + account.substr(-4);
                button.textContent = shortAddress;
                button.disabled = false;

                // 显示通知
                showNotification('BSC钱包连接成功！', 'success');

                // 更新UI状态
                updateUIAfterConnect(account);
            } else {
                throw new Error('连接钱包失败');
            }
        } catch (error) {
            console.error('连接钱包失败:', error);
            button.textContent = '连接钱包';
            button.disabled = false;
            showNotification('连接钱包失败: ' + error.message, 'error');
        }
    }

    // 授权代币功能
    async function approveToken() {
        const tokenAddress = document.getElementById('token-address').value;
        const tokenAmount = document.getElementById('token-amount').value;
        
        if (!tokenAddress || !tokenAmount) {
            showNotification('请输入代币地址和授权数量', 'error');
            return;
        }
        
        const button = document.getElementById('approve-token-btn');
        button.textContent = '授权中...';
        button.disabled = true;
        
        try {
            // 检查钱包是否已连接
            if (!trader.isConnected) {
                await connectWallet();
                if (!trader.isConnected) {
                    throw new Error('请先连接钱包');
                }
            }
            
            // 直接使用字符串形式的数量，让trader.js内部处理转换
            // 不再使用ethers.utils.parseUnits
            const tx = await trader.approveToken(tokenAddress, tokenAmount);
            
            // 添加到代币列表
            addTokenToList(tokenAddress, '已授权');
            
            // 清空输入框
            document.getElementById('token-address').value = '';
            document.getElementById('token-amount').value = '';
            
            showNotification('代币授权成功！', 'success');
        } catch (error) {
            console.error('授权代币失败:', error);
            showNotification('授权代币失败: ' + error.message, 'error');
        } finally {
            button.textContent = '授权代币';
            button.disabled = false;
        }
    }
    
    // 添加代币到列表
    function addTokenToList(tokenAddress, status) {
        const tokenList = document.querySelector('.token-status');
        const shortAddress = tokenAddress.substr(0, 6) + '...' + tokenAddress.substr(-4);
        
        const tokenElement = document.createElement('div');
        tokenElement.className = 'token';
        tokenElement.innerHTML = `
            <span class="token-name">${shortAddress}</span>
            <span class="token-status-value" style="color: #238636;">${status}</span>
        `;
        
        // 插入到列表的第二个位置（在标题行之后）
        tokenList.insertBefore(tokenElement, tokenList.children[2]);
    }
    
    // 执行批量交易
    async function executeBatchTrade() {
        const buyToken = document.getElementById('buy-token').value;
        const buyAmount = document.getElementById('buy-amount').value;
        const sellToken = document.getElementById('sell-token').value;
        const sellAmount = document.getElementById('sell-amount').value;
        const slippage = document.getElementById('slippage').value;
        const deadlineMinutes = document.getElementById('deadline').value;
        
        if (!buyToken || !buyAmount || !sellToken || !sellAmount) {
            showNotification('请填写完整的交易信息', 'error');
            return;
        }
        
        const button = document.getElementById('execute-batch-trade-btn');
        button.textContent = '交易中...';
        button.disabled = true;
        
        try {
            // 检查钱包是否已连接
            if (!trader.isConnected) {
                await connectWallet();
                if (!trader.isConnected) {
                    throw new Error('请先连接钱包');
                }
            }
            
            // 计算截止时间（当前时间 + 分钟数）
            const deadline = Math.floor(Date.now() / 1000) + parseInt(deadlineMinutes);
            
            // 构建交易路径（简化版，实际应根据需要构建）
            // 假设使用WBNB作为中间代币
            const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'; // BSC上的WBNB地址
            const buyPath = [buyToken, WBNB];
            const sellPath = [sellToken, WBNB];
            
            // 直接使用字符串形式的数量，让trader.js内部处理转换
            // 不再使用ethers.utils.parseUnits
            const tx = await trader.executeBatchTrade(
                buyPath,
                sellPath,
                buyAmount,
                sellAmount,
                slippage,
                deadline
            );
            
            // 添加交易记录
            addTradeRecord(tx.transactionHash, '0.01 BNB', new Date().toLocaleString());
            
            showNotification('批量交易执行成功！', 'success');
        } catch (error) {
            console.error('执行批量交易失败:', error);
            showNotification('执行批量交易失败: ' + error.message, 'error');
        } finally {
            button.textContent = '执行批量交易';
            button.disabled = false;
        }
    }
    
    // 添加交易记录
    function addTradeRecord(hash, fee, time) {
        const tableBody = document.querySelector('.trade-table tbody');
        const row = document.createElement('tr');
        
        // 交易哈希列
        const hashCell = document.createElement('td');
        const shortHash = hash.substr(0, 6) + '...' + hash.substr(-4);
        hashCell.textContent = shortHash;
        hashCell.title = hash; // 完整哈希显示为提示
        row.appendChild(hashCell);
        
        // 费用列
        const feeCell = document.createElement('td');
        feeCell.textContent = fee;
        row.appendChild(feeCell);
        
        // 时间列
        const timeCell = document.createElement('td');
        timeCell.textContent = time;
        row.appendChild(timeCell);
        
        // 添加到表格顶部
        tableBody.insertBefore(row, tableBody.firstChild);
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

    // 连接钱包后更新UI
    function updateUIAfterConnect(account) {
        // 启用授权和续期按钮
        document.querySelectorAll('.auth-btn, .renew-btn').forEach(btn => {
            btn.disabled = false;
        });

        // 更新统计面板
        const statItems = document.querySelectorAll('.stat-item p');
        statItems[0].textContent = 'WBNB/BUSD';
        
        // 更新地址显示
        const addressElements = document.querySelectorAll('.address-name');
        if (addressElements.length > 1) {
            const shortAddress = account.substr(0, 6) + '...' + account.substr(-4);
            addressElements[1].textContent = shortAddress;
        }
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