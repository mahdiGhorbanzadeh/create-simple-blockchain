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
    SendGetBlocks(node);
  });
}


function sendAddr(address) {
  const nodes = new Addr(KnownNodes);
  nodes.AddrList.push(nodeAddress);
  const payload = JSON.stringify(nodes); 

  console.log(`Sending data to ${address}:`, payload);
}

function sendBlock(addr, block) {
  const data = new Block(nodeAddress, block); // Create Block object directly with block data
  const payload = JSON.stringify(data); // Using JSON.stringify for serialization
  const cmdBytes = CmdToBytes("block");
  const request = cmdBytes.concat(Buffer.from(payload)); // Convert payload to bytes if necessary

  SendData(addr, request);
}



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

  