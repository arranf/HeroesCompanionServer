const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let buildSchema = new Schema({
  HeroName: String,
  Description: String,
  Talents: [{name: String, level: Number}],
  Submitted: {type: Date, default: Date.now},
  Url: String
});

module.exports = mongoose.model('builds', buildSchema);