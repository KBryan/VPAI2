// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/*
Base
ttps://base-sepolia.blockscout.com/address/0x55635cf82aAD3F330E6e21Bb553cB031b7457518
Arbitrum
https://arbitrum.blockscout.com/address/0x4365CB399c6aD4EfF2D1304F6FD3248201bA4c88?tab=contract

*/

contract AgentNFT is ERC721URIStorage, AccessControl {
    bytes32 public constant AI_AGENT_ROLE = keccak256("AI_AGENT_ROLE");

    uint256 private _nextTokenId;

    constructor(address aiAgent) ERC721("VPAI Agent NFT", "VPAI") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(AI_AGENT_ROLE, aiAgent);
    }

    function updateAgent(address _agent) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(AI_AGENT_ROLE, _agent);
    }

    function mintNFT(
        address to
    ) external onlyRole(AI_AGENT_ROLE) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, generateTokenURI(tokenId));
    }

    function generateTokenURI(uint256 tokenId) public pure returns (string memory) {
        string memory svg = string(abi.encodePacked(
            "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'>",
            "<style>.base { fill: white; font-family: sans-serif; }</style>",
            "<rect width='100%' height='100%' fill='#1A1A1A'/>",
            "<text x='50%' y='35%' class='base' text-anchor='middle' font-size='24'>AI Minted NFT</text>",
            "<text x='50%' y='50%' class='base' text-anchor='middle' font-size='18'>#", uint2str(tokenId), "</text>",
            "</svg>"
        ));

        string memory imageURI = string(
            abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(bytes(svg)))
        );

        string memory json = string(abi.encodePacked(
            '{"name": "AI Minted NFT #', uint2str(tokenId), '", ',
            '"description": "A unique AI-generated NFT", ',
            '"image": "', imageURI, '"}'
        ));

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    function uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function supportsInterface(bytes4 interfaceId)
    public
    view
    override(ERC721URIStorage, AccessControl)
    returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
