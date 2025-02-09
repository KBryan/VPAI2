// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./NebuPool.sol";

contract NebuSwap {
    address[] public allPairs;
    mapping(address => mapping(address => NebuPool)) public getPair;

    event PairCreated(address indexed token1, address indexed token2, address pair);

    constructor() {}

    function createPairs(address token1, address token2, string calldata token1Name, string calldata token2Name)
        external
        returns (address)
    {
        require(token1 != token2, "Identical address is not allowed");
        require(address(getPair[token1][token2]) == address(0), "Pair already exists");

        string memory liquidityTokenName = string(abi.encodePacked("Liquidity-", token1Name, "-", token2Name));
        string memory liquidityTokenSymbol = string(abi.encodePacked("LP-", token1Name, "-", token2Name));


        NebuPool nebuPool = new NebuPool(
            token1,
            token2,
            liquidityTokenName,
            liquidityTokenSymbol);

        getPair[token1][token2] = nebuPool;
        getPair[token2][token1] = nebuPool;
        allPairs.push(address(nebuPool));

        emit PairCreated(token1, token2, address(nebuPool));

        return address(nebuPool);
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    function getPairs() external view returns (address[] memory) {
        return allPairs;
    }
}
