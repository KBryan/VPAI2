// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../lib/forge-std/src/console.sol";
import "../lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "../lib/openzeppelin-contracts/contracts/utils/math/Math.sol";
import "./NebulaLiquidityToken.sol";
import "./SafeMath.sol";

contract NebuPool {
    using Math for uint256;
    using SafeMath for uint256; // For safer arithmetic operations

    address public token1;
    address public token2;
    uint256 public reserve1;
    uint256 public reserve2;

    // x * y = k
    uint256 public constantK;

    NebulaLiquidityToken public liquidityToken;

    event LiquidityAdded(address indexed provider, uint256 amountToken1, uint256 amountToken2, uint256 liquidity);
    event LiquidityRemoved(address indexed provider, uint256 amountToken1, uint256 amountToken2, uint256 liquidity);
    event Swap(address indexed sender, uint256 amountIn, uint256 amountOut, address tokenIn, address tokenOut);

    constructor(
        address _token1,
        address _token2,
        string memory _liquidityTokenName,
        string memory _liquidityTokenSymbol
    ) {
        token1 = _token1;
        token2 = _token2;
        liquidityToken = new NebulaLiquidityToken(
            _liquidityTokenName,
            _liquidityTokenSymbol
        );
    }

    // Get the expected output for a given input amount
    function getExpectedOutput(address fromToken, uint256 amountIn) public view returns (uint256) {
        require(amountIn > 0, "AmountIn must be greater than 0");
        require(fromToken == token1 || fromToken == token2, "Invalid fromToken");

        if (fromToken == token1) {
            return reserve2 - constantK / (reserve1 + amountIn);
        } else {
            return reserve1 - constantK / (reserve2 + amountIn);
        }
    }

    // Add liquidity to the pool
    function addLiquidity(uint256 amountToken1, uint256 amountToken2) external {
        uint256 liquidity;
        uint256 totalSupplyOfToken = liquidityToken.totalSupply();

        // Debugging logs
        console.log("Token1 Allowance:", IERC20(token1).allowance(msg.sender, address(this)));
        console.log("Token2 Allowance:", IERC20(token2).allowance(msg.sender, address(this)));
        console.log("Token1 Balance of User:", IERC20(token1).balanceOf(msg.sender));
        console.log("Token2 Balance of User:", IERC20(token2).balanceOf(msg.sender));

        // Transfer tokens from sender to the pool
        IERC20(token1).transferFrom(msg.sender, address(this), amountToken1);
        IERC20(token2).transferFrom(msg.sender, address(this), amountToken2);

        // Debugging logs after transfer
        console.log("Token1 Balance of Pool After:", IERC20(token1).balanceOf(address(this)));
        console.log("Token2 Balance of Pool After:", IERC20(token2).balanceOf(address(this)));

        if (totalSupplyOfToken == 0) {
            // Initial liquidity pool creation
            liquidity = Math.sqrt(amountToken1.mul(amountToken2));
            require(liquidity > 0, "Insufficient liquidity created");

            // Update reserves
            reserve1 = amountToken1;
            reserve2 = amountToken2;
        } else {
            // Adding liquidity proportional to existing reserves
            uint256 liquidityFromToken1 = amountToken1.mul(totalSupplyOfToken).div(reserve1);
            uint256 liquidityFromToken2 = amountToken2.mul(totalSupplyOfToken).div(reserve2);

            liquidity = Math.min(liquidityFromToken1, liquidityFromToken2);

            // Update reserves
            reserve1 = reserve1.add(amountToken1);
            reserve2 = reserve2.add(amountToken2);
        }

        // Mint liquidity tokens to the provider
        liquidityToken.mint(msg.sender, liquidity);

        // Update the constant formula
        _updateConstantFormula();

        emit LiquidityAdded(msg.sender, amountToken1, amountToken2, liquidity);
    }


    function _updateConstantFormula() internal {
        if (reserve1 == 0 || reserve2 == 0) {
            constantK = 0; // Reset constantK when pool is empty
            console.log("Constant formula reset to 0 as reserves are empty.");
        } else {
            constantK = reserve1.mul(reserve2);
            require(constantK > 0, "Constant formula not updated");
            console.log("Updated Constant K:", constantK);
        }
    }


    // Remove liquidity from the pool
    function removeLiquidity(uint256 liquidity) external {
        uint256 totalSupplyOfToken = liquidityToken.totalSupply();
        require(totalSupplyOfToken > 0, "No liquidity available");

        uint256 amountToken1 = liquidity.mul(reserve1).div(totalSupplyOfToken);
        uint256 amountToken2 = liquidity.mul(reserve2).div(totalSupplyOfToken);

        // Burn liquidity tokens
        liquidityToken.burn(msg.sender, liquidity);

        // Update reserves
        reserve1 = reserve1.sub(amountToken1);
        reserve2 = reserve2.sub(amountToken2);

        // update the constant formula
        _updateConstantFormula();

        // Transfer tokens back to the provider
        IERC20(token1).transfer(msg.sender, amountToken1);
        IERC20(token2).transfer(msg.sender, amountToken2);

        emit LiquidityRemoved(msg.sender, amountToken1, amountToken2, liquidity);
    }

    function swapTokens(address fromToken, address toToken, uint256 amountIn, uint256 amountOut) external {
        // verify the amoutOut is less or equal to expectedAmount after calculation
        // Perform the swap, to transfer into the liquidity pool and to transfer to the swap initiator the amountOut
        // update the reserve1 and reserve2
        // check that the result is maintaining the constant formula x*y = k
        // Add events
        require(amountIn > 0 && amountOut > 0, "Amount must be greater than 0");
        require((fromToken == token1 && toToken == token2) || (fromToken == token1 && toToken == token2), "Tokens need to be pairs of this liquidity pool");
        IERC20 fromTokenContract = IERC20(fromToken);
        IERC20 toTokenContract = IERC20(toToken);
        require(fromTokenContract.balanceOf(msg.sender) > amountIn, "Insufficient balance of tokenFrom");
        require(toTokenContract.balanceOf(address (this)) > amountOut, "Insufficient balance of tokenTo");
        uint256 expectedAmount;
        if(fromToken == token1){
            expectedAmount = reserve2 - constantK / (reserve1 + amountIn);
        }else{
            expectedAmount = reserve1 - constantK / (reserve2 + amountIn);
        }
        require(amountOut <= expectedAmount,"Swap does not preserve constant formula");
        require(fromTokenContract.transferFrom(msg.sender, address(this),amountIn),"Transfer of token failed");
        require(toTokenContract.transfer(msg.sender, expectedAmount),"Transfer of token to failed");

        if(fromToken == token1 && toToken == token2) {
            reserve1 = reserve1.add(amountIn);
            reserve2 = reserve2.sub(expectedAmount);
        } else {
            reserve1 = reserve1.sub(expectedAmount);
            reserve2 = reserve2.add(amountIn);
        }
        // check that the result if maintaining the constant formula x*y = k
        require(reserve1.mul(reserve2) == constantK, "Swap does not preserve constant formula");

        emit Swap(msg.sender,amountIn,expectedAmount,fromToken, toToken);

    }

    // Get the current reserves of the pool
    function getReserves() external view returns (uint256, uint256) {
        return (reserve1, reserve2);
    }
}
