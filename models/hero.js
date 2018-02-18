const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let heroSchema = new Schema({
  HeroId: Number,
  Name: String,
  ShortName: String,
  AttributeId: String,
  IconFileName: String,
  Role: String,
  Type: String,
  ReleaseDate: String,
  Sha3256: String
});

module.exports = mongoose.model('heroes', heroSchema);