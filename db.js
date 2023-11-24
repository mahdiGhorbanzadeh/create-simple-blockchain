const { Level } = require('level')

var path = require('path');

require('dotenv').config()


var dbPath = path.join(process.env.DB_PATH, 'mydb');   

console.log("dbPath",dbPath)

var db = new Level(dbPath);

async function x(){
   const value = await db.get('key 1')
   console.log("value",value)   
}


x()


