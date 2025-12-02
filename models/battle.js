const mongoose = require("mongoose");

const battleSchema = new mongoose.Schema({
  salons: [{
    salonName: String,
    salonImage: String,
    vote: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }]
  }],
  battleName: String,
  description:String,
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  status: {
    type: String,
    enum: ["Start", "End"],
    default: "Start"
  }
});

const battleModel = mongoose.model("Battle", battleSchema);
module.exports = battleModel;
