const battleModel = require("../models/battle");

const createBattle = async (req, res) => {
  try {
    const salons = JSON.parse(req.body.salons);

    if (!salons || salons.length < 2) {
      return res.status(200).json({
        success: false,
        message: "Battle must have at least 2 salons",
      });
    }

    const battleSalons = salons.map((salon, index) => ({
      salonName: salon.salonName,
      salonImage: req.files?.[index]?.filename || null,
    }));

    const battle = new battleModel({
      battleName: req.body.battleName,
      description: req.body.description,
      salons: battleSalons,
    });

    await battle.save();

    res.status(200).json({
      success: true,
      message: "Battle created successfully",
      data: battle,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to create battle.",
      error: error.message,
    });
  }
};

const updateWholeBattle = async (req, res) => {
  try {
    const { battleId, salonId, salonName } = req.body;
    let updatedBattle;
    if (battleId) {
      const { ...updateData } = req.body;

      updatedBattle = await battleModel.findByIdAndUpdate(
        battleId,
        { $set: updateData },
        { new: true }
      );

      if (!updatedBattle) {
        return res.status(200).json({
          success: false,
          message: "Battle not found.",
        });
      }
    }

    if (salonId) {
      let salonImage = req.body.salonImage;
      if (req.file) {
        salonImage = req.file.filename;
      }

      updatedBattle = await battleModel.findOneAndUpdate(
        { "salons._id": salonId },
        {
          $set: {
            "salons.$.salonName": salonName,
            "salons.$.salonImage": salonImage,
          },
        },
        { new: true }
      );

      if (!updatedBattle) {
        return res.status(200).json({
          success: false,
          message: "Battle or salon not found",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Battle updated successfully",
      data: updatedBattle,
    });
  } catch (error) {
    console.error("Error updating salon:", error);
    res.status(400).json({
      success: false,
      message: "Failed to update battle.",
      error: error.message,
    });
  }
};

async function deleteBattle(req, res) {
  try {
    const { id } = req.body;
    const deletedBattle = await battleModel.findByIdAndDelete(id);

    if (!deletedBattle) {
      return res.status(404).json({
        success: false,
        message: "Battle not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Battle has been deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting battle:", error);
    return res.status(400).json({
      success: false,
      message: "Failed to delete battle.",
      error: error.message,
    });
  }
}

async function getBattleById(req, res) {
  try {
    const { battleId } = req.query;
    const battle = await battleModel.findById(battleId);

    if (!battle) {
      return res.status(200).json({
        success: false,
        message: "Battle not found.",
      });
    }

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
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const battles = await battleModel.find(filter);
    if (battles.length == 0) {
      return res.status(200).json({
        success: false,
        message: "Battle fnot found.",
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
    const { battleId, salonId, userId } = req.body;

    if (!battleId || !userId) {
      return res.status(200).json({
        success: false,
        message: "battleId and userId are required.",
      });
    }

    const battle = await battleModel.findOneAndUpdate(
      { _id: battleId },
      { $pull: { "salons.$[].vote": userId } }, // $[] = all elements in array
      { new: true }
    );

    if (!battle) {
      return res
        .status(200)
        .json({ success: false, message: "Battle not found." });
    }

    let updatedBattle = battle;
    if (salonId) {
      updatedBattle = await battleModel.findOneAndUpdate(
        { _id: battleId, "salons._id": salonId },
        { $addToSet: { "salons.$.vote": userId } },
        { new: true }
      );

      if (!updatedBattle) {
        return res
          .status(200)
          .json({ success: false, message: "Salon not found in this battle." });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Vote updated successfully.",
      data: updatedBattle,
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
  deleteBattle,
  getBattleById,
  getAllBattle,
  addOrRemoveVotes,
  updateWholeBattle,
};
