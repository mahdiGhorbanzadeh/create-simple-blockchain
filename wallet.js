
const crypto = require('crypto');
const bitcoin = require('bitcoinjs-lib');
const EC = require('elliptic').ec;
const bs58 = require('bs58');
const fs = require('fs')

class Wallet {
    
    constructor(){
        if(fs.existsSync("wallet.txt")){
          this.loadWallet()
        }else{
          this.newKeyPair()
        }
    }

    loadWallet(){
      fs.readFile('wallet.txt', (err, file) => {
        let wallet = JSON.parse(file);

        console.log("wallet",wallet);
        
        this.PrivateKey = wallet.PrivateKey;
        this.PublicKey = wallet.PublicKey;
        
      })
    }

    newKeyPair(){
      // Create a new EC key pair
      const ec = new EC('secp256k1');
      const key = ec.genKeyPair();
    
      // Get the private and public key in hex format
      const privateKey = key.getPrivate('hex');
      const publicKey = key.getPublic('hex');

      let wallet = {
        PrivateKey:privateKey,
        PublicKey:publicKey
      }

      fs.writeFile('wallet.txt', JSON.stringify(wallet), (err) => {})
    }
    
    address(){
    
        let publicKey = this.PublicKey;

        const publicKeyBuffer = Buffer.from(publicKey, 'hex');
        const hash = crypto.createHash('sha256').update(publicKeyBuffer).digest();
        const ripemd160 = crypto.createHash('ripemd160').update(hash).digest();
        const base58Address = bs58.encode(Buffer.from(ripemd160));
    
        return base58Address          
    }
    
}

module.exports = {
  Wallet
}