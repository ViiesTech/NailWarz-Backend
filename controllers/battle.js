const { default: mongoose } = require("mongoose");
const { CONTENT_STATUS } = require("../constants/contentStatus");
const battleModel = require("../models/battle");
const Content = require("../models/content");
const moment = require("moment");
const { BATTLE_STATUS, BATTLE_STATUS_ARRAY } = require("../constants/battleStatus");

const createBattle = async (req, res) => {
  let session;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const { name, description, startDate, endDate, participants } = req.body;

    if (!name) return res.status(400).json({ success: false, message: "name is required" });
    if (!description) return res.status(400).json({ success: false, message: "description is required" });
    if (!startDate) return res.status(400).json({ success: false, message: "startDate is required" });
    if (!endDate) return res.status(400).json({ success: false, message: "endDate is required" });
    if (!Array.isArray(participants) || participants.length < 2) {
      return res.status(400).json({ success: false, message: "At least 2 participants are required" });
    }

    const start = moment(startDate, "DD-MM-YYYY hh:mm a", true);
    const end = moment(endDate, "DD-MM-YYYY hh:mm a", true);

    if (!start.isValid() || !end.isValid()) {
      return res.status(400).json({ success: false, message: "Invalid startDate or endDate format" });
    }

    if (end.isSameOrBefore(start)) {
      return res.status(400).json({ success: false, message: "endDate must be greater than startDate" });
    }

    const participantDocs = await Content.find({
      _id: { $in: participants },
      status: CONTENT_STATUS.SELECTED
    });

    if (participantDocs.length !== participants.length) {
      return res.status(400).json({
        success: false,
        message: "Some participants are missing or not selected"
      });
    }

    // 3️⃣ Prepare battle participants array
    const battleParticipants = participantDocs.map(p => ({
      participant: {
        name: p.name,
        description: p.description,
        phone: p.phone,
        email: p.email,
        address: p.address,
        images: p.images,
        social: p.social
      },
      vote: []
    }));

    const [newBattle] = await battleModel.create(
      [{
        name,
        description,
        startDate: start.toDate(),
        endDate: end.toDate(),
        participants: battleParticipants
      }],
      { session }
    );

    // 6️⃣ Remove participants from Content collection
    await Content.deleteMany(
      { _id: { $in: participants } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({ success: true, message: "Battle created successfully", battle: newBattle });

  } catch (error) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    res.status(400).json({
      success: false,
      message: "Failed to create battle.",
      error: error.message,
    });
  }
};

const updateBattle = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, startDate, endDate } = req.body;

    const battle = await battleModel.findById(id);
    if (!battle) return res.status(404).json({ success: false, message: "Battle not found" });

    const updateData = {};

    if (name) {
      if (typeof name !== "string") {
        return res.status(400).json({ success: false, message: "Invalid name" });
      }
      updateData.name = name.trim();
    }

    // ✅ description
    if (description) {
      if (typeof description !== "string") {
        return res.status(400).json({ success: false, message: "Invalid description" });
      }
      updateData.description = description.trim();
    }

    let start = battle.startDate;
    let end = battle.endDate;

    // ✅ startDate
    if (startDate) {
      const parsedStart = moment(startDate, "DD-MM-YYYY hh:mm a", true);
      if (!parsedStart.isValid()) {
        return res.status(400).json({ success: false, message: "Invalid startDate format" });
      }
      start = parsedStart.toDate();
      updateData.startDate = start;
    }

    // ✅ endDate
    if (endDate) {
      const parsedEnd = moment(endDate, "DD-MM-YYYY hh:mm a", true);
      if (!parsedEnd.isValid()) {
        return res.status(400).json({ success: false, message: "Invalid endDate format" });
      }
      end = parsedEnd.toDate();
      updateData.endDate = end;
    }

    if (start && end && moment(end).isSameOrBefore(moment(start))) {
      return res.status(400).json({
        success: false, message: "endDate must be greater than startDate"
      });
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update"
      });
    }

    const updatedBattle = await battleModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Battle updated successfully",
      battle: updatedBattle
    });

  } catch (error) {
    console.error("Error updating battle:", error);
    res.status(400).json({
      success: false,
      message: "Failed to update battle.",
      error: error.message,
    });
  }
};

const updateBattleParticipants = async (req, res) => {
  let session;
  try {
    const { id } = req.params;
    const { addParticipants = [], removeParticipants = [] } = req.body;

    session = await mongoose.startSession();
    session.startTransaction();

    const battle = await battleModel.findById(id).session(session);
    if (!battle) {
      return res.status(404).json({ success: false, message: "Battle not found" });
    }

    if (battle.status !== "upcoming") {
      return res.status(400).json({
        success: false,
        message: "Participants can only be updated before battle starts"
      });
    }

    /* ===========================
       1️⃣ ADD PARTICIPANTS VALIDATION
    ============================ */
    const addDocs = await Content.find({
      _id: { $in: addParticipants },
      status: CONTENT_STATUS.SELECTED
    }).session(session);

    if (addDocs.length !== addParticipants.length) {
      return res.status(400).json({
        success: false,
        message: "Some addParticipants are missing or not selected"
      });
    }

    /* ===========================
       🔴 DUPLICATE EMAIL IN BATTLE CHECK (NEW)
    ============================ */
    const battleEmails = battle.participants.map(
      bp => bp.participant.email
    );

    for (const doc of addDocs) {
      if (battleEmails.includes(doc.email)) {
        return res.status(400).json({
          success: false,
          message: `Participant already exists in battle: ${doc.email}`
        });
      }
    }

    /* ===========================
       2️⃣ REMOVE PARTICIPANTS VALIDATION
    ============================ */
    for (const email of removeParticipants) {
      // Skip emails which are in addParticipants to avoid duplicates
      if (addDocs.some(p => p.email === email)) continue;

      const exists = await Content.findOne({ email }).session(session);
      if (exists) {
        return res.status(400).json({
          success: false, message: `Email already exists in content: ${email}`
        });
      }
    }

    /* ===========================
       3️⃣ REMOVE PARTICIPANTS FROM BATTLE (TEMP STORE)
    ============================ */
    const tempRemovedParticipants = [];
    const remainingParticipants = [];

    for (const bp of battle.participants) {
      if (removeParticipants.includes(bp.participant.email)) {
        tempRemovedParticipants.push(bp.participant);
      } else {
        remainingParticipants.push(bp);
      }
    }

    /* ===========================
       4️⃣ ADD NEW PARTICIPANTS TO BATTLE
    ============================ */
    const tempAddParticipants = addDocs.map(p => ({
      participant: {
        name: p.name,
        description: p.description,
        phone: p.phone,
        email: p.email,
        address: p.address,
        images: p.images,
        social: p.social
      },
      vote: []
    }));

    battle.participants = [...remainingParticipants, ...tempAddParticipants];

    /* ===========================
       5️⃣ CHECK MINIMUM PARTICIPANTS
    ============================ */
    if (battle.participants.length < 2) {
      throw new Error("Battle must have at least 2 participants after removal and addition");
    }

    /* ===========================
       6️⃣ DELETE ADD PARTICIPANTS FROM CONTENT
    ============================ */
    await Content.deleteMany({ _id: { $in: addParticipants } }, { session });

    /* ===========================
       7️⃣ COMMIT SESSION (SAFE)
    ============================ */
    await battle.save({ session });
    await session.commitTransaction();
    session.endSession();

    /* ===========================
       8️⃣ RECREATE REMOVED PARTICIPANTS IN CONTENT
    ============================ */
    for (const p of tempRemovedParticipants) {
      await Content.create([{
        name: p.name,
        description: p.description,
        phone: p.phone,
        email: p.email,
        address: p.address,
        images: p.images || [],
        social: p.social,
        status: CONTENT_STATUS.SELECTED
      }]);
    }

    return res.status(200).json({
      success: true,
      message: "Battle participants updated successfully",
      battle
    });

  } catch (error) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    console.error("Error updateBattleParticipants:", error);
    res.status(400).json({
      success: false,
      message: "Failed to update battle.",
      error: error.message,
    });
  }
};
async function getBattleById(req, res) {
  try {
    const { id } = req.params;
    const battle = await battleModel.findById(id);

    if (!battle) return res.status(200).json({ success: false, message: "Battle not found." });


    return res.status(200).json({
      success: true,
      message: "Battle fetched successfully.",
      data: battle,
    });
  } catch (error) {
    console.error("Error fetching battle:", error);
    return res.status(400).json({
      success: false,
      message: "Failed to fetch battle.",
      error: error.message,
    });
  }
}

async function getAllBattle(req, res) {
  try {
    const { status, search } = req.query;

    const filter = {};

    if (status) {
      if (!BATTLE_STATUS_ARRAY.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Allowed values are: ${BATTLE_STATUS_ARRAY.join(", ")}`
        });
      }
      filter.status = status
    }

    if (search) filter.name = { $regex: search, $options: "i" };


    const battles = await battleModel.find(filter);
    if (battles.length == 0) {
      return res.status(400).json({
        success: false, message: "Battle not found.",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Battles fetched successfully.",
      data: battles,
    });
  } catch (error) {
    console.error("Error fetching battles:", error);
    return res.status(400).json({
      success: false,
      message: "Failed to fetch battles.",
      error: error.message,
    });
  }
}

const addOrRemoveVotes = async (req, res) => {
  try {
    const { battleId, participantId, userId } = req.body;

    if (!battleId) return res.status(200).json({ success: false, message: "battle Id is required.", });
    if (!participantId) return res.status(200).json({ success: false, message: "participant Id is required.", });
    if (!userId) return res.status(200).json({ success: false, message: "user Id is required.", });


    // 1️⃣ Find the battle
    const battle = await battleModel.findById(battleId);
    if (!battle) return res.status(404).json({ success: false, message: "Battle not found." });

    if (battle.status !== BATTLE_STATUS.ACTIVE) {
      return res.status(400).json({
        success: false,
        message: "Voting is allowed only while the battle is active."
      });
    }

    // 2️⃣ Find the participant inside battle.participants
    const participantIndex = battle.participants.findIndex(
      p => p.participant._id.toString() === participantId
    );
    if (participantIndex === -1) {
      return res.status(404).json({ success: false, message: "Participant not found in this battle." });
    }

    // 3️⃣ Toggle vote
    const votesArray = battle.participants[participantIndex].vote;
    const voteIndex = votesArray.findIndex(v => v.toString() === userId);

    if (voteIndex === -1) {
      // Add vote
      votesArray.push(userId);
    } else {
      // Remove vote
      votesArray.splice(voteIndex, 1);
    }

    // 4️⃣ Update totalVotes
    battle.totalVotes = battle.participants.reduce((acc, p) => acc + p.vote.length, 0);

    // 5️⃣ Save battle
    await battle.save();

    return res.status(200).json({
      success: true,
      message: voteIndex === -1 ? "Vote added." : "Vote removed.",
    });

  } catch (error) {
    console.error("Error updating vote:", error);
    return res.status(400).json({
      success: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
};

module.exports = {
  createBattle,
  getBattleById,
  getAllBattle,
  addOrRemoveVotes,
  updateBattle,
  updateBattleParticipants
};
