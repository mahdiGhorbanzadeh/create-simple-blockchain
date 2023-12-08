
const fs = require('fs').promises; // Using fs.promises to access the promised-based fs functions

const { Wallet } = require('./wallet');

const walletFile = "wallet.data"

class Wallets {

    wallets = {};

    addWallet(){
        let wallet = new Wallet();

        wallet.makeWallet();

        let address =  wallet.getAddress();
        
        this.wallets[address] = wallet;

        return address;
    }

    getWallet(address){
        return this.wallets[address];
    }

    async loadFile(){
        try {
            const file = await fs.readFile(walletFile);
            let wallets = JSON.parse(file);
            this.wallets = wallets;            
        } catch (error) {
            console.log("error",error)
        }

    }

    saveFile(){
        fs.writeFile(walletFile, JSON.stringify(this.wallets), (err) => {})
    }

}

module.exports = {
    Wallets
}