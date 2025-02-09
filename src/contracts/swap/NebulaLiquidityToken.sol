// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "../lib/openzeppelin-contracts-upgradeable/lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "../lib/openzeppelin-contracts-upgradeable/lib/openzeppelin-contracts/contracts/access/AccessControl.sol";

contract NebulaLiquidityToken is ERC20,AccessControl {
    constructor(string memory _name,string memory _symbol) ERC20(_name,_symbol){
        _grantRole(DEFAULT_ADMIN_ROLE,msg.sender);
    }

    function mint(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _mint(to, amount);
    }

    // Burn function to destroy liquidity tokens
    function burn(address from, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _burn(from, amount);
    }
}
