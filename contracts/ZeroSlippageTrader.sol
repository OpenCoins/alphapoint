// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// PancakeSwap Router接口
interface IPancakeRouter {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
}

// ERC20代币接口
interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

/**
 * @title ZeroSlippageTrader
 * @dev 一个用于BSC链上零滑点交易的智能合约
 * 支持批量交易和最小化滑点
 */
contract ZeroSlippageTrader {
    address public owner;
    IPancakeRouter public router;
    
    // 事件
    event TokenApproved(address indexed token, uint256 amount);
    event BatchTradeExecuted(address[] buyPath, address[] sellPath, uint256 buyAmount, uint256 sellAmount);
    event TradeExecuted(address[] path, uint256 amountIn, uint256 amountOut);
    
    // 错误
    error InsufficientOutputAmount(uint256 expected, uint256 actual);
    error Unauthorized();
    error TransactionFailed();
    
    // 构造函数
    constructor(address _routerAddress) {
        owner = msg.sender;
        router = IPancakeRouter(_routerAddress);
    }
    
    // 修饰符
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }
    
    /**
     * @dev 授权代币给PancakeSwap路由器
     * @param token 要授权的代币地址
     * @param amount 授权金额
     */
    function approveToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).approve(address(router), amount);
        emit TokenApproved(token, amount);
    }
    
    /**
     * @dev 检查代币授权状态
     * @param token 代币地址
     * @return 已授权的金额
     */
    function checkTokenAllowance(address token) external view returns (uint256) {
        return IERC20(token).allowance(address(this), address(router));
    }
    
    /**
     * @dev 执行单个交易
     * @param amountIn 输入金额
     * @param amountOutMin 最小输出金额
     * @param path 交易路径
     * @param deadline 交易截止时间
     */
    function executeTrade(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        uint256 deadline
    ) external onlyOwner {
        // 确保合约有足够的代币
        require(IERC20(path[0]).balanceOf(address(this)) >= amountIn, "Insufficient token balance");
        
        // 确保代币已授权给路由器
        require(IERC20(path[0]).allowance(address(this), address(router)) >= amountIn, "Token not approved");
        
        // 执行交易
        uint[] memory amounts = router.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            address(this),
            deadline
        );
        
        emit TradeExecuted(path, amountIn, amounts[amounts.length - 1]);
    }
    
    /**
     * @dev 执行批量交易（买卖同时进行，减少价格影响）
     * @param buyPath 买入路径
     * @param sellPath 卖出路径
     * @param buyAmountIn 买入输入金额
     * @param sellAmountIn 卖出输入金额
     * @param maxSlippagePercent 最大滑点百分比（以基点表示，100 = 1%）
     * @param deadline 交易截止时间
     */
    function executeBatchTrade(
        address[] calldata buyPath,
        address[] calldata sellPath,
        uint256 buyAmountIn,
        uint256 sellAmountIn,
        uint256 maxSlippagePercent,
        uint256 deadline
    ) external onlyOwner {
        // 确保合约有足够的代币
        require(IERC20(buyPath[0]).balanceOf(address(this)) >= buyAmountIn, "Insufficient buy token balance");
        require(IERC20(sellPath[0]).balanceOf(address(this)) >= sellAmountIn, "Insufficient sell token balance");
        
        // 确保代币已授权给路由器
        require(IERC20(buyPath[0]).allowance(address(this), address(router)) >= buyAmountIn, "Buy token not approved");
        require(IERC20(sellPath[0]).allowance(address(this), address(router)) >= sellAmountIn, "Sell token not approved");
        
        // 计算预期输出金额
        uint[] memory buyAmountsOut = router.getAmountsOut(buyAmountIn, buyPath);
        uint[] memory sellAmountsOut = router.getAmountsOut(sellAmountIn, sellPath);
        
        // 计算最小输出金额（应用滑点容差）
        uint256 buyAmountOutMin = buyAmountsOut[buyAmountsOut.length - 1] * (10000 - maxSlippagePercent) / 10000;
        uint256 sellAmountOutMin = sellAmountsOut[sellAmountsOut.length - 1] * (10000 - maxSlippagePercent) / 10000;
        
        // 执行买入交易
        uint[] memory buyAmounts = router.swapExactTokensForTokens(
            buyAmountIn,
            buyAmountOutMin,
            buyPath,
            address(this),
            deadline
        );
        
        // 执行卖出交易
        uint[] memory sellAmounts = router.swapExactTokensForTokens(
            sellAmountIn,
            sellAmountOutMin,
            sellPath,
            address(this),
            deadline
        );
        
        emit BatchTradeExecuted(buyPath, sellPath, buyAmounts[buyAmounts.length - 1], sellAmounts[sellAmounts.length - 1]);
    }
    
    /**
     * @dev 从合约中提取代币
     * @param token 代币地址
     * @param amount 提取金额
     */
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }
    
    /**
     * @dev 从合约中提取BNB
     * @param amount 提取金额
     */
    function withdrawBNB(uint256 amount) external onlyOwner {
        (bool success, ) = owner.call{value: amount}("");
        if (!success) revert TransactionFailed();
    }
    
    // 允许合约接收BNB
    receive() external payable {}
}