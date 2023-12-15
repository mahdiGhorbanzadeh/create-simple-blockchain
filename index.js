const {Blockchain} = require('./blockchain')
const {DB} = require("./db")
const {newTransaction, getBalance, coinbaseTx} = require("./transaction")
const { UTXOSet } = require('./utxo')
const {Wallet} = require("./wallet")
const { Wallets } = require('./wallets')

async function main(){

   let address = "1KjEwXdZPHk2od3ztmAJQenXWkLQtHm7YX";


   let blockchain = new Blockchain(address);
  
   await new Promise(resolve => setTimeout(resolve, 1000));

   // ------------------ create blockchain 

   blockchain.initBlockchain(address);

   await new Promise(resolve => setTimeout(resolve, 1000));

   

   let from = "1KjEwXdZPHk2od3ztmAJQenXWkLQtHm7YX";

   let to = "17nL68bqPqMTNPC8D8YXHmkwEUYbVresUh";

   let amount = 30;


   

   // await new Promise(resolve => setTimeout(resolve, 1000));



   // let tx = await newTransaction("jonatan","ali","50",blockchain)

   // await blockchain.addBlock([tx])
   
   // console.log("...............................................")

   await new Promise(resolve => setTimeout(resolve, 1000));


   blockchain.iterate();

   await new Promise(resolve => setTimeout(resolve, 1000));

   let utxo = new UTXOSet(blockchain);

   await utxo.reIndex();

   await new Promise(resolve => setTimeout(resolve, 1000));

   let tx = await newTransaction(from, to, amount, utxo);

   console.log("tx",tx);




   // let tx2 = await newTransaction("jonatan","mahdi","25",blockchain)

   // blockchain.addBlock([tx2])

   // let tx3 = await newTransaction("ali","mahdi","25",blockchain)

   // blockchain.addBlock([tx3])


   // blockchain.addBlock("First block after Genesis")
  //  blockchain.addBlock("Second block after Genesis")
  //  blockchain.addBlock("Third block after Genesis")
  
   // let x = await blockchain.findUTXO("mahdi")

   // console.log("x",x)

   
   // blockchain.iterate()


   //----------------------------------------

   // let wallets = new Wallets()

   // await wallets.loadFile()

   // let my_wallet = wallets.getWallet(address)

   // let wallet = new Wallet()

   // wallet.updateWallet(my_wallet.PublicKey,my_wallet.PrivateKey);


   // let hash = wallet.base58Decode("171WnfYxrM9VZv3e1m8Sd8RqWHvmfgGxTe")

   // console.log("hash",hash)

   
   // let address = wallets.addWallet()

   // console.log("address",address)

   // let address2 = wallets.addWallet()

   // console.log("address2",address2)

   // wallets.saveFile()

   //-----------------------------------------

   // wallets.loadFile()

   // console.log("wallets",JSON.stringify(wallets.wallets,null,2))

}


async function createWallet(){
   let wallets = new Wallets()

   let address = wallets.addWallet()

   console.log("address",address)

   let address2 = wallets.addWallet()

   console.log("address2",address2)

   wallets.saveFile()
}

async function createBlockChain(iterate = true){

   let wallets = new Wallets()

   await wallets.loadFile()

   let address = "1JGDVKFjy1uvwc9nTQVw9c711CXhx2Fm86"


   let blockchain = new Blockchain(address);

   await new Promise(resolve => setTimeout(resolve, 1000));

   await blockchain.initBlockchain(address);

   if(iterate){
      await blockchain.iterate()
   }

   return blockchain
}

let transactions = [];

async function createTransactionDB(reset=true){

   if(reset){
      transactions=[]
   }

   let wallets = new Wallets()

   await wallets.loadFile()

   let blockchain = await createBlockChain(false);
   
   
   let utxo = new UTXOSet(blockchain);

   await utxo.reIndex();

   let from = "1JGDVKFjy1uvwc9nTQVw9c711CXhx2Fm86";

   let to = "15vAVgu6MPKtqUjJYycqgfwN3HqXChnwxH";

   let amount = 5;

   let tx = await newTransaction(from, to, amount, utxo);

   console.log("tx",tx);

   transactions.push(tx)
}

async function createBlock(){
   
   console.log("transactions",transactions);

   let blockchain = await createBlockChain(false);

   blockchain.addBlock(transactions)
}

async function getBalanceUser(){
   let address = '1JGDVKFjy1uvwc9nTQVw9c711CXhx2Fm86'
   
   let blockchain = await createBlockChain(false);
   
   let utxo = new UTXOSet(blockchain);

   let balance = await getBalance(address,utxo);

   console.log("user ",address , "  balance is  ",balance);
}

async function main2(){
   // await createBlockChain();
   await createTransactionDB();
   await createBlock();
}


getBalanceUser()

// createWallet();

createBlockChain();

// createTransactionDB();

// main2();

// main()