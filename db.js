const { Level } = require('level')

let PATH = require('path');

require('dotenv').config()


let dbPath = PATH.join(process.env.DB_PATH, 'mydb');   

let DB = new Level(dbPath);



module.exports = {
   DB,
   LH_KEY:"lh"
}


