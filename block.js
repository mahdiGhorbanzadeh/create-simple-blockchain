
const {sha256} = require('js-sha256');
const { newMerkleTree } = require('./merkle');

class Block {
    constructor(Timestamp,Hash,Transactions,PrevHash,Nonce,Height){
        this.Timestamp = Timestamp;
        this.Hash = Hash;
        this.Transactions = Transactions;
        this.PrevHash =PrevHash;
        this.Nonce = Nonce; 
        this.Height = Height;
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
