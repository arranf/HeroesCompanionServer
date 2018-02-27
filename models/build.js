const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let buildSchema = new Schema({
  HeroId: {type: Number, required: true},
  Description: String,
  Tagline: String,
  Talents: 
  [{ 
    Name: {type: String, required: true}, 
    TalentTreeId: {type: String, required: true}, 
    Level: {type: Number, required: true},
  }],
  Submitted: { type: Date, default: Date.now },
  Source: {type: String, required: true},
  Url: String,
  Md5: { type: String, unique: true, select: false },
  __v: { type: Number, select: false}
});

module.exports = mongoose.model('builds', buildSchema);
