const mongoose = require("mongoose");
const { BATTLE_STATUS_ARRAY, BATTLE_STATUS } = require("../constants/battleStatus");

const participantDetailsSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, },
  address: { type: String, required: true },
  images: { type: [String], default: [] },
  social: {
    name: {
      type: String,
      required: [true, "Social name is required"]
    },
    platform: {
      type: String,
      required: [true, "Social platform is required"],
    }
  },
}, { _id: true })

const battleParticipantSchema = new mongoose.Schema({
  participant: participantDetailsSchema,
  vote: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }]
}, { _id: false });

const battleSchema = new mongoose.Schema({
  participants: {
    type: [battleParticipantSchema],
    validate: {
      validator: function (val) {
        return val.length >= 2; // at least 2 participants
      },
      message: "Battle must have at least 2 participants"
    }
  },
  name: { type: String, required: true },
  description: { type: String },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  winner: {
    type: participantDetailsSchema,
    default: null
  },
  status: {
    type: String,
    enum: BATTLE_STATUS_ARRAY,
    default: BATTLE_STATUS.UPCOMING
  },
  totalVotes: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

battleSchema.index({ status: 1, startDate: 1 });
battleSchema.index({ status: 1, endDate: 1 });

const battleModel = mongoose.model("Battle", battleSchema);
module.exports = battleModel;
