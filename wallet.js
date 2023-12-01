
const crypto = require('crypto');
const EC = require('elliptic').ec;
const bs58 = require('bs58');
const fs = require('fs')


const CHECK_SUM_LENGTH = 4;

const VERSION = Buffer.from("00","hex");

const walletFile = "wallet.data"
class Wallet {
    
    constructor(){
        if(fs.existsSync(walletFile)){
          this.loadWallet()
        }else{
          this.newKeyPair()
        }
    }

    loadWallet(){
      fs.readFile(walletFile, (err, file) => {
        let wallet = JSON.parse(file);
        
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

      this.PrivateKey = privateKey;
      this.PublicKey = publicKey;

      let wallet = {
        PrivateKey:privateKey,
        PublicKey:publicKey
      }

      fs.writeFile(walletFile, JSON.stringify(wallet), (err) => {})
    }

    generatePublicKeyHash(){
      
      let publicKey = this.PublicKey;

      console.log("publicKey",publicKey)
      
      const publicKeyBuffer = Buffer.from(publicKey, 'hex');

      console.log("publicKeyBuffer",publicKeyBuffer)
        
      const hash = crypto.createHash('sha256').update(publicKeyBuffer).digest();

      const publicKeyHash = crypto.createHash('ripemd160').update(hash).digest();

      return publicKeyHash;
    }

    generateCheckSum(payload){
      const hashOnce = crypto.createHash('sha256').update(payload).digest();
      const hashTwice = crypto.createHash('sha256').update(hashOnce).digest();

      return hashTwice.slice(0,CHECK_SUM_LENGTH);
    }

    base58Encode(input){
      return bs58.encode(input);
    }

    base58Decode(input){
      return bs58.decode(input);
    }

    
    getAddress(){
      let pubKeyHash = this.generatePublicKeyHash()  
      
      let versionedHash = Buffer.concat([VERSION,pubKeyHash])

      console.log("versionedHash",VERSION)

      let checksum = this.generateCheckSum(versionedHash)
    
      let fullHash = Buffer.concat([versionedHash,checksum])

      let address = this.base58Encode(fullHash)

      console.log("address",address)

      return address
    }
    
}

module.exports = {
  Wallet
}