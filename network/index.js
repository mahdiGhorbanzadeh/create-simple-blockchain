const net = require("net");
const { Readable } = require("stream");
const { Blockchain } = require("../blockchain");
const { UTXOSet } = require("../utxo");
const { deserializeTransaction, Transaction, coinbaseTx } = require("../transaction");

const COMMAND_LENGTH = 12;
const VERSION = 1

let nodeAddress = "";
let mineAddress = "";
let KnownNodes = ["localhost:3000"];
let blocksInTransit = [];
let memoryPool = {};

class Addr {
  constructor(addrList = []) {
    this.AddrList = addrList;
  }
}
class Block {
  constructor(addrFrom = "", block = Buffer.alloc(0)) {
    this.AddrFrom = addrFrom;
    this.Block = block;
  }
}
class GetData {
  constructor(addrFrom = "", type = "", id = []) {
    this.AddrFrom = addrFrom;
    this.Type = type;
    this.ID = id;
  }
}
class Inv {
  constructor(addrFrom = "", type = "", items = []) {
    this.AddrFrom = addrFrom;
    this.Type = type;
    this.Items = items;
  }
}
class Tx {
  constructor(addrFrom = "", transaction = Buffer.alloc(0)) {
    this.AddrFrom = addrFrom;
    this.Transaction = transaction; // Initialize with an empty Buffer or provided transaction data
  }
}
class Version {
  constructor(version = 0, bestHeight = 0, addrFrom = "") {
    this.Version = version;
    this.BestHeight = bestHeight;
    this.AddrFrom = addrFrom;
  }
}

function cmdToBytes(cmd) {
  const bytes = Buffer.alloc(COMMAND_LENGTH);
  bytes.write(cmd);
  return bytes;
}

function bytesToCmd(bytes) {
  let cmd = "";

  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== 0x0) {
      cmd += String.fromCharCode(bytes[i]);
    }
  }

  return cmd;
}

function extractCmd(request) {
  const commandLength = 12; // Define your command length here

  return request.slice(0, commandLength);
}

function requestBlocks() {
  KnownNodes.forEach((node) => {
    sendGetBlocks(node);
  });
}

function sendAddr(address) {
  const nodes = new Addr(KnownNodes);
  nodes.AddrList.push(nodeAddress);
  const payload = JSON.stringify(nodes);

  console.log(`Sending data to ${address}:`, payload);
}

function sendBlock(addr, block) {
  const data = new Block(nodeAddress, block);
  const payload = JSON.stringify(data);
  const request = Buffer.concat([cmdToBytes("block"), Buffer.from(payload)]);

  sendData(addr, request);
}

// first try to connect destination node
// if success send data with dataStream
// if fail remove node from node list

function sendData(addr, data) {
  const client = new net.Socket();

  client.on("error", (err) => {
    console.log(`${addr} is not available`);
    let updatedNodes = KnownNodes.filter((node) => node !== addr);
    KnownNodes = updatedNodes;
    client.destroy();
  });

  client.connect({ port: addr.split("localhost:")[1] }, () => {
    const dataStream = new Readable();
    dataStream.push(data);
    dataStream.push(null);

    dataStream.pipe(client);
  });

  client.on("close", () => {
    console.log("Connection closed");
  });
}

function sendInv(address, kind, items) {
  console.log("------------------sendInv-------------------------")
  const inventory = {
    AddrFrom: nodeAddress,
    Type: kind,
    Items: items,
  };

  const payload = JSON.stringify(inventory);

  const request = Buffer.concat([cmdToBytes("inv"), Buffer.from(payload)]);

  sendData(address, request);
}

function sendGetData(address, kind, id) {
  console.log("------------------sendGetData-------------------------")
  const payload = GobEncode({ nodeAddress, kind, id });
  const request = Buffer.concat([cmdToBytes("getdata"), payload]);

  sendData(address, request);
}

function sendGetBlocks(address) {
  console.log("------------------sendGetBlocks-------------------------")
  const payload = JSON.stringify({ AddrFrom: nodeAddress });
  const request = Buffer.concat([
    cmdToBytes("getblocks"),
    Buffer.from(payload),
  ]);

  sendData(address, request);
}

function sendTx(addr, tnx) {
  console.log("------------------sendTx-------------------------")
  
  
  const serializedTx = tnx.serialize ? tnx.serialize() : tnx;

  const data = {
    AddrFrom: nodeAddress,
    Transaction: serializedTx,
  };

  const payload = JSON.stringify(data);

  const request = Buffer.concat([cmdToBytes("tx"), Buffer.from(payload)]);

  sendData(addr, request);
}

async function sendVersion(addr, chain) {

  console.log(`------------------ sendVersion ${addr}-------------------------`)


  const bestHeight = await chain.getBestHeight();
  
  const payload = JSON.stringify({
    Version: VERSION,
    BestHeight: bestHeight,
    AddrFrom: nodeAddress,
  });

  const request = Buffer.concat([cmdToBytes("version"), Buffer.from(payload)]);

  sendData(addr, request);
}

function handleAddr(request) {

  console.log("------------------handleAddr-------------------------")


  const commandLength = 12;

  const payload = JSON.parse(request.slice(commandLength).toString());

  knownNodes.push(...payload.AddrList);

  console.log(`There are ${knownNodes.length} known nodes`);

  RequestBlocks();
}

async function handleBlock(request, chain) {

  console.log("------------------handleBlock-------------------------")


  const commandLength = 12;

  const payload = JSON.parse(request.slice(commandLength).toString());

  console.log("payload",payload);

  const blockData = payload.Block;

  const block = blockData;

  console.log("Received a new block! ",block);

  await chain.addBlock(block);

  console.log(`Added block ${block.Hash}`);

  console.log("blocksInTransit",blocksInTransit)

  if (blocksInTransit.length > 0) {
    const blockHash = blocksInTransit[0];
    
    sendGetData(payload.AddrFrom, "block", blockHash);

    blocksInTransit = blocksInTransit.slice(1);
  } else {
    const utxo = new UTXOSet(chain);
    await utxo.reIndex();
  }
}

function handleInv(request, chain) {

  console.log("------------------handleInv-------------------------")


  const commandLength = 12;

  const payload = JSON.parse(request.slice(commandLength).toString());

  console.log(
    `Received inventory with ${payload.Items.length} ${payload.Type}`
  );

  if (payload.Type === "block") {
    blocksInTransit = payload.Items;

    const blockHash = payload.Items[0];

    sendGetData(payload.AddrFrom, "block", blockHash);

    console.log("blocksInTransit",blocksInTransit)

    let list = [];

    for (let i = 0; i < blocksInTransit.length; i++) {
      if(blocksInTransit[i] !== blockHash){
        list.push(blocksInTransit[i])
      }
    }

    const newInTransit = list;

    console.log("newInTransit",newInTransit)

    blocksInTransit = newInTransit;
  }

  if (payload.Type === "tx") {
    const txID = payload.Items[0];

    if (!memoryPool[txID]) {
      sendGetData(payload.AddrFrom, "tx", txID);
    }
  }
}

async function handleGetBlocks(request, chain) {

  console.log("------------------handleGetBlocks-------------------------")

  const commandLength = 12;

  const payload = JSON.parse(request.slice(commandLength).toString());

  const blocks = await chain.getBlockHashes();

  sendInv(payload.AddrFrom, "block", blocks);
}

async function handleGetData(request, chain) {

  console.log("------------------handleGetData-------------------------")

  const commandLength = 12;

  const payload = JSON.parse(request.slice(commandLength).toString());

  
  if (payload.kind === "block") {

    console.log("getBlock ID",payload.id)
    
    let block = await chain.getBlock(payload.id)

    sendBlock(payload.nodeAddress, block);

  }else if (payload.kind === "tx") {

    const txID = payload.id;
    const tx = memoryPool[txID];

    if (tx) {
      sendTx(payload.nodeAddress, tx);
    } else {
      console.error(`Transaction ${txID} not found in memory pool`);
    }
  }
}

async function handleTx(request, chain) {

  console.log("------------------ handleTx -------------------------")

  const commandLength = 12;

  const payload = JSON.parse(request.slice(commandLength).toString());

  const tx = deserializeTransaction(payload.Transaction);

  memoryPool[tx.ID] = tx;

  console.log(`${nodeAddress}, ${Object.keys(memoryPool).length}`);

  if (nodeAddress === KnownNodes[0]) {
    KnownNodes.forEach((node) => {
      if (node !== nodeAddress && node !== payload.AddrFrom) {
        sendInv(node, "tx", [tx.ID]);
      }
    });
  } 

  console.log("Object.keys(memoryPool).length",Object.keys(memoryPool),Object.keys(memoryPool).length >= 2,mineAddress);

  if (Object.keys(memoryPool).length >= 2 && mineAddress) {
    await mineTx(chain);
  }

  console.log("------------------finish handleTx-------------------------")

}

async function mineTx(chain) {

  console.log("------------------mineTx-------------------------")


  const txs = [];

  for (const id in memoryPool) {
    console.log(`tx: ${memoryPool[id].ID}`);
    const tx = memoryPool[id];
    if (await chain.verifyTransaction(tx)) {
      txs.push(tx);
    }
  }

  if (txs.length === 0) {
    console.log("All Transactions are invalid");
    return;
  }

  const cbTx = coinbaseTx(mineAddress, "");

  txs.push(cbTx);

  const newBlock = await chain.mineBlock(txs);

  console.log("newBlock",newBlock)

  const utxo = new UTXOSet(chain);
  
  await utxo.reIndex();

  console.log("New Block mined");

  for (const tx of txs) {
    console.log("tx for delete from memory pool",tx)
    const txID = tx.ID;
    delete memoryPool[txID];
  }

  for (const node of KnownNodes) {
    if (node !== nodeAddress) {
      sendInv(node, "block", [newBlock.Hash]);
    }
  }

  if (Object.keys(memoryPool).length > 0) {
    await mineTx(chain);
  }
}

async function handleVersion(request, chain) {

  console.log("------------------handleVersion-------------------------")

  const payload = JSON.parse(request.slice(COMMAND_LENGTH).toString());

  const bestHeight = await chain.getBestHeight();

  console.log("bestHeight",bestHeight)

  const otherHeight = payload.BestHeight;

  console.log("otherHeight",payload , otherHeight)


  if (bestHeight < otherHeight) {
    await sendGetBlocks(payload.AddrFrom);
  } else if (bestHeight > otherHeight) {
    await sendVersion(payload.AddrFrom, chain);
  }

  if (!nodeIsKnown(payload.AddrFrom)) {
    KnownNodes.push(payload.AddrFrom);
  }
}

async function handleConnection(data, chain) {

  console.log("------------------handleConnection-------------------------")


  const commandLength = 12;
  const command = bytesToCmd(data.slice(0, commandLength));
  console.log(`Received ${command} command`);

  switch (command) {
    case "addr":
      handleAddr(data);
      break;
    case "block":
      await handleBlock(data, chain);
      break;
    case "inv":
      handleInv(data, chain);
      break;
    case "getblocks":
      await handleGetBlocks(data, chain);
      break;
    case "getdata":
      await handleGetData(data, chain);
      break;
    case "tx":
      await handleTx(data, chain);
      break;
    case "version":
      await handleVersion(data, chain);
      break;
    default:
      console.log("Unknown command");
  }
}

const startServer = async (nodeID, minerAddress,address) => {

  console.log("------------------startServer-------------------------")


  nodeAddress = `localhost:${nodeID}`;
  mineAddress = minerAddress;


  if (nodeAddress !== KnownNodes[0]) {

    console.log("----------------run here--------------------------")
    
    const chain = new Blockchain(address, nodeID);

    await chain.continueBlockchain(address);

    await sendVersion(KnownNodes[0], chain);

    await chain.closeDB();
  }


  const server = net.createServer(async(socket) => {
    console.log("New connection established");
    

    // if (nodeAddress !== KnownNodes[0]) {

    //   console.log("----------------run here--------------------------")
      
    //   const chain = new Blockchain(address, nodeID);
  
    //   await chain.continueBlockchain(address);
  
    //   await sendVersion(KnownNodes[0], chain);
  
    //   await chain.closeDB();
    // }
  

    socket.on("data", async (data) => {
      
      let chain = new Blockchain(address, nodeID);

      await chain.continueBlockchain(address);

      await handleConnection(data, chain);

      await chain.closeDB();

    });

    socket.on("error", (err) => {
      console.error("Connection error:", err);
    });

    socket.on("close", () => {
      console.log("Connection closed");
    });
  });

  server.on("error", (err) => {
    console.error("Server error:", err);
  });

  server.listen(nodeID,"localhost", () => {
    console.log(`Server running on localhost:${nodeID}`);
  });
};

function GobEncode(data) {
  try {
    const encodedData = JSON.stringify(data);
    return Buffer.from(encodedData);
  } catch (error) {
    console.error(error);
    return null;
  }
}

function nodeIsKnown(addr) {
  return KnownNodes.includes(addr);
}

module.exports = {
  startServer,
  sendTx,
  KnownNodes,
};
