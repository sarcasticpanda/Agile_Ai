const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');
const client = new MongoClient('mongodb+srv://agileai_user:smiles1@se-project.q1qk8ha.mongodb.net/agileai?retryWrites=true&w=majority');
async function run() {
  try {
    await client.connect();
    const db = client.db('agileai');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);
    await db.collection('users').updateOne({ email: 'admin@agileai.com' }, { $set: { password: hashedPassword } });
    console.log('Password reset to password123');
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
