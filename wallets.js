
const fs = require('fs');
const { Wallet } = require('./wallet');

const walletFile = "wallet.data"

class Wallets {

    wallets = {};

    addWallet(){
        let wallet = new Wallet();

        wallet.makeWallet();

        let address =  wallet.getAddress();
        
        this.wallets[address] = wallet;
    }

    getWallet(address){
        return this.wallets[address];
    }

    loadFile(){
        fs.readFile(walletFile, (err, file) => {
            let wallets = JSON.parse(file);
            
            console.log("wallets",wallets);
            
            this.wallets = wallets; 
          })
    }

    saveFile(){
        fs.writeFile(walletFile, JSON.stringify(this.wallets), (err) => {})
    }

}

module.exports = {
    
}