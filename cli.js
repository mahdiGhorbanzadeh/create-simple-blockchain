const { program } = require("commander");
const { Wallet } = require("./wallet");
const {
  startServer,
  KnownNodes,
  sendTx,
  sendData,
  cmdToBytes,
} = require("./network");
const { Blockchain } = require("./blockchain");
const { UTXOSet } = require("./utxo");
const { Wallets } = require("./wallets");
const { newTransaction, coinbaseTx, getBalance } = require("./transaction");
const { address } = require("bitcoinjs-lib");

class CommandLine {
  async startNode(nodeID, minerAddress, address) {
    console.log(`Starting Node ${nodeID}`);

    if (minerAddress) {
      if (Wallet.validateAddress(minerAddress)) {
        console.log("Mining is on. Address to receive rewards:", minerAddress);
      } else {
        console.error("Wrong miner address!");
        process.exit(1);
      }
    }

    await startServer(nodeID, minerAddress, address);
  }

  async reindexUTXO(address, nodeID) {
    const chain = new Blockchain(address, nodeID);

    await chain.continueBlockchain(address);

    const utxo = new UTXOSet(chain);

    await utxo.reIndex();

    const count = await utxo.countTransactions();

    await chain.closeDB();

    console.log(`Done! There are ${count} transactions in the UTXO set.`);
  }

  createWallet(nodeID) {
    let wallets = new Wallets();

    let address = wallets.addWallet();

    wallets.saveFile(nodeID);

    console.log(`New address is: ${address}`);
  }

  async printChain(address, nodeID) {
    const chain = new Blockchain(address, nodeID);

    await chain.continueBlockchain(true);

    await chain.iterate();
  }

  async getBalanceUser(address, nodeID) {
    const chain = new Blockchain(address, nodeID);

    await chain.continueBlockchain(address);

    let utxo = new UTXOSet(chain);

    let balance = await getBalance(address, utxo, nodeID);

    await chain.closeDB();

    console.log("Balance of ", address, "  :  ", balance);
  }

  async send(from, to, amount, nodeID, mineNow) {
    const payload = JSON.stringify({
      from,
      to,
      amount,
      nodeID,
    });

    const request = Buffer.concat([
      cmdToBytes("getTxFromCmd"),
      Buffer.from(payload),
    ]);

    sendData(`localhost:${nodeID}`, request);
  }

  async returnChain(address, nodeID) {
    const chain = new Blockchain(address, nodeID);

    await chain.continueBlockchain(address);

    const utxo = new UTXOSet(chain);

    await utxo.returnChain("");
  }
}

const cli = new CommandLine();

program
  .command("startnode")
  .description("Start a node")
  .option("-n, --nodeid <nodeid>", "Set node ID")
  .option("-m, --miner <miner>", "Set miner address")
  .option("-a, --address <address>", "Set address")
  .action((options) => {
    cli.startNode(options.nodeid, options.miner, options.address);
  });
//-------> node ./cli.js startnode -n 3000 -m

program
  .command("reindex")
  .description("reindex the database")
  .option("-n, --nodeid <nodeid>", "Set node ID")
  .option("-a, --address <address>", "Set address")
  .action((options) => {
    cli.reindexUTXO(options.address, options.nodeid);
  });

program
  .command("createwallet")
  .description("create wallet")
  .option("-n, --nodeid <nodeid>", "Set node ID")
  .action((options) => {
    cli.createWallet(options.nodeid);
  });

//------> node ./cli.js createwallet -n 3000

program
  .command("printchain")
  .description("print chain")
  .option("-n, --nodeid <nodeid>", "Set node ID")
  .option("-a, --address <address>", "Set address")
  .action((options) => {
    cli.printChain(options.address, options.nodeid);
  });

program
  .command("returnchain")
  .description("return chain")
  .option("-n, --nodeid <nodeid>", "Set node ID")
  .option("-a, --address <address>", "Set address")
  .action((options) => {
    cli.returnChain(options.address, options.nodeid);
  });

program
  .command("getuserbalance")
  .description("get user balance")
  .option("-a, --address <address>", "Set address")
  .option("-n, --nodeid <nodeid>", "Set node ID")
  .action((options) => {
    cli.getBalanceUser(options.address, options.nodeid);
  });

program
  .command("send")
  .description("create tx and send them to users")
  .option("-f, --from <from>", "from address")
  .option("-t, --to <to>", "to address")
  .option("-m, --amount <amount>", "amount")
  .option("-n, --nodeid <nodeid>", "Set node ID")
  .option("-i, --mine <mineNow>", "mine now")
  .action((options) => {
    cli.send(
      options.from,
      options.to,
      options.amount,
      options.nodeid,
      options.mineNow
    );
  });

program.parse(process.argv);
