
const crypto = require('crypto');
const EC = require('elliptic').ec;
const bs58 = require('bs58');
const fs = require('fs')


const CHECK_SUM_LENGTH = 4;

const VERSION = Buffer.from("00","hex");

const walletFile = "wallet.data"
class Wallet {
    
    constructor(){}

    loadWallet(){
      fs.readFile(walletFile, (err, file) => {
        let wallet = JSON.parse(file);
        
        this.PrivateKey = wallet.PrivateKey;
        this.PublicKey = wallet.PublicKey;
        
      })
    }

    makeWallet(){
      this.newKeyPair();
    }

    newKeyPair(){
      // Create a new EC key pair
      const ec = new EC('p256');
      const key = ec.genKeyPair();
    
      // Get the private and public key in hex format
      const privateKey = key.getPrivate('hex');
      const publicKey = key.getPublic('hex');

      this.PrivateKey = privateKey;
      this.PublicKey = publicKey;
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

      return address
    }

    validateAddress(address){
      let publicKeyHash  = this.base58Decode(address)
      
      let actualChecksum = publicKeyHash.slice(publicKeyHash.length-4,publicKeyHash.length);

      let version = publicKeyHash.slice(0,1);

      publicKeyHash =  publicKeyHash.slice(1,publicKeyHash.length-4)

      let targetCheckSum = this.generateCheckSum(Buffer.concat([version,publicKeyHash]))
      
      return Buffer.compare(actualChecksum,targetCheckSum) == 0
    }
    
}

function generatePublicKeyHash(publicKey){
      
  console.log("publicKey",publicKey)
  
  const publicKeyBuffer = Buffer.from(publicKey, 'hex');

  console.log("publicKeyBuffer",publicKeyBuffer)
    
  const hash = crypto.createHash('sha256').update(publicKeyBuffer).digest();

  const publicKeyHash = crypto.createHash('ripemd160').update(hash).digest();

  return publicKeyHash;
}

function base58Encode(input){
  return bs58.encode(input);
}

function base58Decode(input){
  return bs58.decode(input);
}

module.exports = {
  Wallet,
  generatePublicKeyHash,
  base58Decode,
  base58Encode
}