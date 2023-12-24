const { program } = require('commander');
const {Wallet} = require('./wallet'); 
const { startServer, KnownNodes, sendTx } = require('./network'); 
const {Blockchain} = require('./blockchain');
const { UTXOSet } = require('./utxo');
const { Wallets } = require('./wallets');
const { newTransaction, coinbaseTx, getBalance } = require('./transaction');

class CommandLine {
    startNode(nodeID, minerAddress) {
        console.log(`Starting Node ${nodeID}`);

        if (minerAddress) {
            if (Wallet.validateAddress(minerAddress)) {
                console.log("Mining is on. Address to receive rewards:", minerAddress);
            } else {
                console.error("Wrong miner address!");
                process.exit(1);
            }
        }

        startServer(nodeID, minerAddress);
    }

    async reindexUTXO(address , nodeID) {
        const chain = new Blockchain(address,nodeID)

        await new Promise(resolve => setTimeout(resolve, 1000));

        const utxo = new UTXOSet(chain);

        await utxo.reIndex();

        const count = await utxo.countTransactions();

        console.log(`Done! There are ${count} transactions in the UTXO set.`);
    }

    createWallet(nodeID) {

        let wallets = new Wallets()

        let address = wallets.addWallet()

        wallets.saveFile(nodeID);

        console.log(`New address is: ${address}`);
    }

    async printChain(address , nodeID){
        const chain = new Blockchain(address,nodeID)

        await new Promise(resolve => setTimeout(resolve, 1000));

        chain.iterate()
    }

    async createBlockChain(address, nodeID) {
        const chain = new Blockchain(address, nodeID);

        await new Promise(resolve => setTimeout(resolve, 1000));

        const utxo = new UTXOSet(chain);
        
        await utxo.reIndex();

        console.log("Finished!");
    }

    async getBalanceUser(address, nodeID){        
        const chain = new Blockchain(address, nodeID);
        
        await new Promise(resolve => setTimeout(resolve, 1000));

        let utxo = new UTXOSet(chain);
     
        let balance = await getBalance(address,utxo,nodeID);
     
        console.log("Balance of ",address , "  :  ",balance);
    }

    async send(from, to, amount, nodeID, mineNow) {
        if (!Wallet.validateAddress(to)) {
            console.error("Address is not Valid");
            process.exit(1);
        }
        
        if (!Wallet.validateAddress(from)) {
            console.error("Address is not Valid");
            process.exit(1);
        }

        const chain = new Blockchain(from,nodeID);
        
        

        const utxo = new UTXOSet(chain);

        const tx = newTransaction(from, to, amount, utxo,nodeID);

        if (mineNow) {
            const cbTx = coinbaseTx(from, "");

            const txs = [cbTx, tx];
            
            const block = await chain.mineBlock(txs);
            
            await utxo.update(block);
        } else {
            sendTx(KnownNodes[0], tx);

            console.log("send tx");
        }

        console.log("Success!");
    }
        
}

const cli = new CommandLine();

program
    .command('startnode')
    .description('Start a node')
    .option('-n, --nodeid <nodeid>', 'Set node ID')
    .option('-m, --miner <miner>', 'Set miner address')
    .action((options) => {
        cli.startNode(options.nodeid, options.miner);
    });


program
    .command('reindex')
    .description('reindex the database')
    .option('-n, --nodeid <nodeid>', 'Set node ID')
    .option('-a, --address <address>', 'Set address')
    .action((options) => {
        cli.reindexUTXO(options.address,options.nodeid);
    });

program
    .command('createwallet')
    .description('create wallet')
    .option('-n, --nodeid <nodeid>', 'Set node ID')
    .action((options) => {
        cli.createWallet(options.nodeid);
    });

program
    .command('printchain')
    .description('print chain')
    .option('-n, --nodeid <nodeid>', 'Set node ID')
    .option('-a, --address <address>', 'Set address')
    .action((options) => {
        cli.printChain(options.address,options.nodeid);
    });

program
    .command('createblockchain')
    .description('create blockchain')
    .option('-n, --nodeid <nodeid>', 'Set node ID')
    .option('-a, --address <address>', 'Set address')
    .action((options) => {
        console.log("options",options)
        cli.createBlockChain(options.address,options.nodeid);
    });


program
    .command('getuserbalance')
    .description('get user balance')
    .option('-a, --address <address>', 'Set address')
    .option('-n, --nodeid <nodeid>', 'Set node ID')
    .action((options) => {
        cli.getBalanceUser(options.address,options.nodeid);
    });

program
    .command('send')
    .description('create tx and send them to users')
    .option('-f, --from <from>', 'from address')
    .option('-t, --to <to>', 'to address')
    .option('-m, --amount <amount>', 'amount')
    .option('-n, --nodeid <nodeid>', 'Set node ID')
    .option('-i, --mine <mineNow>', 'mine now')
    .action((options) => {
        cli.send(options.from,options.to,options.amount,options.nodeid,options.mineNow);
    });




program.parse(process.argv);