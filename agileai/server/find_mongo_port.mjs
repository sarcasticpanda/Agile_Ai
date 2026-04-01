#!/usr/bin/env node
// Quick MongoDB port tester
import mongoose from 'mongoose';
import { createServer } from 'net';

async function testPort(port) {
  return new Promise((resolve) => {
    const socket = createServer();
    const client = new (await import('net')).Socket();
    client.setTimeout(2000);
    client.connect(port, 'localhost', () => {
      client.destroy();
      resolve(true);
    });
    client.on('error', () => resolve(false));
    client.on('timeout', () => { client.destroy(); resolve(false); });
  });
}

const ports = [27017, 27018, 27019, 27020, 27021, 37017];
for (const port of ports) {
  try {
    const uri = `mongodb://localhost:${port}/test?serverSelectionTimeoutMS=2000&connectTimeoutMS=2000`;
    const conn = await mongoose.createConnection(uri).asPromise();
    console.log(`✅ MongoDB FOUND on port ${port}`);
    await conn.close();
    process.exit(0);
  } catch(e) {
    console.log(`❌ Port ${port}: ${e.message.substring(0, 80)}`);
  }
}
console.log('No MongoDB found on any port');
process.exit(1);
