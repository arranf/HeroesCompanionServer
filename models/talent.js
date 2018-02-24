const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let talentSchema = new Schema({
  HeroId: Number,
  AbilityId: String,
  TalentTreeId: String,
  ToolTipId: String,
  Level: Number,
  SortOrder: Number,
  Name: String,
  Description: String,
  IconFileName: String,
  Sha3256: String,
  __v: { type: Number, select: false}
});

module.exports = mongoose.model('talents', talentSchema);
