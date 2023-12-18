const net = require('net');
const { Readable } = require('stream');

const COMMAND_LENGTH = 12;

let nodeAddress ='';
let mineAddress= '';
let KnownNodes = ["localhost:3000"]
let blocksInTransit = [];
let memoryPool = {};

class Addr {
  constructor(addrList=[]) {
    this.AddrList = addrList;
  }
}
class Block {
  constructor(addrFrom ='',block=Buffer.alloc(0)){
    this.AddrFrom = addrFrom
    this.Block = block 
  }
}
class GetData {
  constructor(addrFrom='', type='', id=[]) {
    this.AddrFrom = addrFrom;
    this.Type = type;
    this.ID = id;
  }
}
class Inv {
  constructor(addrFrom='', type='', items=[]) {
    this.AddrFrom = addrFrom;
    this.Type = type;
    this.Items = items; 
  }
}
class Tx {
  constructor(addrFrom='', transaction=Buffer.alloc(0)) {
    this.AddrFrom = addrFrom;
    this.Transaction = transaction; // Initialize with an empty Buffer or provided transaction data
  }
}
class Version {
  constructor(version=0, bestHeight=0, addrFrom='') {
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
  let cmd = '';

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
  KnownNodes.forEach(node => {
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
  const cmdBytes = CmdToBytes("block");
  const request = cmdBytes.concat(Buffer.from(payload)); 

  sendData(addr, request);
}


// first try to connect destination node
// if success send data with dataStream
// if fail remove node from node list

function sendData(addr, data) {
    const client = new net.Socket();
  
    client.on('error', (err) => {
      console.log(`${addr} is not available`);
      let updatedNodes = KnownNodes.filter((node) => node !== addr);
      KnownNodes = updatedNodes;
      client.destroy();
    });
  
    client.connect({ port: PORT, host: addr }, () => {
      const dataStream = new Readable();
      dataStream.push(data);
      dataStream.push(null);
  
      dataStream.pipe(client);
    });
  
    client.on('close', () => {
      console.log('Connection closed');
    });
}

function sendInv(address, kind, items) {
  const inventory = {
    AddrFrom: nodeAddress, 
    Type: kind,
    Items: items,
  };

  const payload = JSON.stringify(inventory); 

  const request = Buffer.concat([
    cmdToBytes('inv'), 
    Buffer.from(payload), 
  ]);

  sendData(address, request); 
}

function sendGetBlocks(address) {
  const payload = JSON.stringify({ AddrFrom: nodeAddress });
  const request = Buffer.concat([
    cmdToBytes('getblocks'), 
    Buffer.from(payload), 
  ]);

  sendData(address, request);
}

function SendTx(addr, tnx) {
  const serializedTx = tnx.Serialize(); 

  const data = {
    AddrFrom: nodeAddress, 
    Transaction: serializedTx,
  };

  const payload = JSON.stringify(data);

  const request = Buffer.concat([
    cmdToBytes('tx'), 
    Buffer.from(payload), 
  ]);

  sendData(addr, request); 
}

function sendVersion(addr, chain) {
  const bestHeight = chain.GetBestHeight(); 
  const payload = JSON.stringify({
    Version: version, 
    BestHeight: bestHeight,
    AddrFrom: nodeAddress, 
  });

  const request = Buffer.concat([
    cmdToBytes('version'), 
    Buffer.from(payload), 
  ]);

  sendData(addr, request); 
}

function handleAddr(request) {
  const commandLength = 12; 

  const payload = JSON.parse(request.slice(commandLength).toString()); 
  
  knownNodes.push(...payload.AddrList); 
  
  console.log(`There are ${knownNodes.length} known nodes`);
  
  RequestBlocks();
}

function handleBlock(request, chain) {
  const commandLength = 12;

  const payload = JSON.parse(request.slice(commandLength).toString()); 

  const blockData = payload.Block;
  const block = blockchain.Deserialize(blockData); 

  console.log("Received a new block!");
  chain.AddBlock(block); 

  console.log(`Added block ${block.Hash}`);

  if (blocksInTransit.length > 0) {
    const blockHash = blocksInTransit[0];
    SendGetData(payload.AddrFrom, "block", blockHash);

    blocksInTransit = blocksInTransit.slice(1); 
  } else {
    const UTXOSet = new blockchain.UTXOSet(chain); 
    UTXOSet.Reindex();
  }
}

function handleInv(request, chain) {
  const commandLength = 12; 

  const payload = JSON.parse(request.slice(commandLength).toString());

  console.log(`Received inventory with ${payload.Items.length} ${payload.Type}`);

  if (payload.Type === 'block') {
    blocksInTransit = payload.Items;

    const blockHash = payload.Items[0];
    SendGetData(payload.AddrFrom, 'block', blockHash); 

    const newInTransit = blocksInTransit.filter(b => !Buffer.from(b).equals(Buffer.from(blockHash)));
    blocksInTransit = newInTransit;
  }

  if (payload.Type === 'tx') {
    const txID = payload.Items[0];

    if (!memoryPool[txID]) {
      SendGetData(payload.AddrFrom, 'tx', txID); 
    }
  }
}

function handleGetBlocks(request, chain) {
  const commandLength = 12; 

  const payload = JSON.parse(request.slice(commandLength).toString());

  const blocks = chain.GetBlockHashes(); 
  
  sendInv(payload.AddrFrom, "block", blocks); 
}

function handleGetData(request, chain) {
  const commandLength = 12;

  const payload = JSON.parse(request.slice(commandLength).toString()); 

  if (payload.Type === "block") {
    chain.GetBlock(Buffer.from(payload.ID)) 
      .then(block => {
        SendBlock(payload.AddrFrom, block); 
      })
      .catch(err => {
        console.error(err);
      });
  }

  if (payload.Type === "tx") {
    const txID = Buffer.from(payload.ID).toString('hex');
    const tx = memoryPool[txID];

    if (tx) {
      SendTx(payload.AddrFrom, tx); 
    } else {
      console.error(`Transaction ${txID} not found in memory pool`);
    }
  }
}

function handleTx(request, chain) {
  const commandLength = 12; 

  const payload = JSON.parse(request.slice(commandLength).toString()); // Assuming payload is in JSON format

  const tx = blockchain.DeserializeTransaction(payload.Transaction); // Deserialize transaction data
  memoryPool[Buffer.from(tx.ID).toString('hex')] = tx; 
  
  console.log(`${nodeAddress}, ${Object.keys(memoryPool).length}`);

  if (nodeAddress === KnownNodes[0]) {
    KnownNodes.forEach(node => {
      if (node !== nodeAddress && node !== payload.AddrFrom) {
        sendInv(node, "tx", [tx.ID]);
      }
    });
  } else {
    if (Object.keys(memoryPool).length >= 2 && mineAddress.length > 0) {
      mineTx(chain);
    }
  }
}

async function mineTx(chain) {
  const txs = [];

  for (const id in memoryPool) {
    console.log(`tx: ${memoryPool[id].ID}`);
    const tx = memoryPool[id];
    if (chain.VerifyTransaction(tx)) {
      txs.push(tx);
    }
  }

  if (txs.length === 0) {
    console.log("All Transactions are invalid");
    return;
  }

  const cbTx = blockchain.CoinbaseTx(mineAddress, "");
  txs.push(cbTx);

  const newBlock = await chain.MineBlock(txs);
  const UTXOSet = new blockchain.UTXOSet(chain);
  await UTXOSet.Reindex();

  console.log("New Block mined");

  for (const tx of txs) {
    const txID = Buffer.from(tx.ID).toString('hex');
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

function handleVersion(request, chain) {
  const payload = JSON.parse(request.slice(COMMAND_LENGTH).toString()); 

  const bestHeight = chain.GetBestHeight();
  const otherHeight = payload.BestHeight;

  if (bestHeight < otherHeight) {
    sendGetBlocks(payload.AddrFrom); 
  } else if (bestHeight > otherHeight) {
    sendVersion(payload.AddrFrom, chain);
  }

  if (!NodeIsKnown(payload.AddrFrom)) {
    KnownNodes.push(payload.AddrFrom);
  }
}

function handleConnection(data, chain) {
  const commandLength = 12; 
  const command = bytesToCmd(data.slice(0, commandLength));
  console.log(`Received ${command} command`);

  switch (command) {
      case 'addr':
          handleAddr(data);
          break;
      case 'block':
          handleBlock(data, chain);
          break;
      case 'inv':
          handleInv(data, chain);
          break;
      case 'getblocks':
          handleGetBlocks(data, chain);
          break;
      case 'getdata':
          handleGetData(data, chain);
          break;
      case 'tx':
          handleTx(data, chain);
          break;
      case 'version':
          handleVersion(data, chain);
          break;
      default:
          console.log('Unknown command');
  }
}

const startServer = (nodeID, minerAddress) => {
  nodeAddress = `localhost:${nodeID}`;
  mineAddress = minerAddress;

  const server = net.createServer((socket) => {
    console.log('New connection established');

    const chain = blockchain.ContinueBlockChain(nodeID); 
    chain.Database.close(); 

    if (nodeAddress !== KnownNodes[0]) {
      sendVersion(KnownNodes[0], chain);
    }

    socket.on('data', (data) => {
      handleConnection(data, chain);
    });

    socket.on('error', (err) => {
      console.error('Connection error:', err);
    });

    socket.on('close', () => {
      console.log('Connection closed');
    });
  });

  server.on('error', (err) => {
    console.error('Server error:', err);
  });

  server.listen(nodeID, 'localhost', () => {
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

function closeDB(chain) {
  const cleanupFunction = () => {
  chain.Database.close(); 
    process.exit(1);
  };

  process.on('SIGINT', cleanupFunction);
  process.on('SIGTERM', cleanupFunction);
}