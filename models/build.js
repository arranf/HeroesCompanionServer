const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let buildSchema = new Schema({
  HeroId: Number,
  Description: String,
  Talents: [{ Name: String, TalentTreeId: String, Level: Number }],
  Submitted: { type: Date, default: Date.now },
  Url: String,
  Md5: { type: String, unique: true }
});

module.exports = mongoose.model('builds', buildSchema);
