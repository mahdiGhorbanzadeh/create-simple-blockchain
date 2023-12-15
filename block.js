
const {sha256} = require('js-sha256');
const { newMerkleTree } = require('./merkle');

class Block {
    constructor(Hash,Transactions,PrevHash,Nonce){
        this.Hash = Hash;
        this.Transactions = Transactions;
        this.PrevHash =PrevHash;
        this.Nonce = Nonce; 
    }

    hashTransactions(){
        let hashes = [];
        let hash = ''

        
        this.Transactions.map(item=>{
            hashes.push(item.ID);
        })

        let tree = newMerkleTree(hashes);
        
        return hash;
    }
}


module.exports = { Block }
