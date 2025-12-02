const refundModel = require("../models/refund");

const applyForRefund = async (req, res) => {
  try {
    const refundRequest = new refundModel(req.body);
    const savedRefund = await refundRequest.save();

    return res.status(200).json({
      success: true,
      message: "Refund request submitted successfully.",
      data: savedRefund,
    });
  } catch (error) {
    console.error("Error applying for refund:", error);
    return res.status(400).json({
      success: false,
      message: "An error occurred while submitting the refund request.",
      error: error.message,
    });
  }
};

const updateRefundStatus = async (req, res) => {
  try {
    const { refundId, status } = req.body;

    const updatedRefund = await refundModel.findByIdAndUpdate(
      refundId,
      { status },
      { new: true }
    );

    if (!updatedRefund) {
      return res.status(200).json({
        success: false,
        message: "Refund request not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Refund status updated successfully.",
      data: updatedRefund,
    });
  } catch (error) {
    console.error("Error updating refund status:", error);
    return res.status(400).json({
      success: false,
      message: "An error occurred while updating the refund status.",
      error: error.message,
    });
  }
};

const getRefundById = async (req, res) => {
  try {
    const { refundId } = req.query;

    const refund = await refundModel.findById(refundId);

    if (!refund) {
      return res.status(200).json({
        success: false,
        message: "Refund request not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Refund request retrieved successfully.",
      data: refund,
    });
  } catch (error) {
    console.error("Error retrieving refund:", error);
    return res.status(400).json({
      success: false,
      message: "An error occurred while retrieving the refund request.",
      error: error.message,
    });
  }
};

const getAllRefund = async (req, res) => {
  try {
    const { salonId, userId ,status} = req.query;
    const filter = {};

    if (salonId) filter.salonId = salonId;
    if (userId) filter.userId = userId;
    if (status) filter.status = status;
    const refunds = await refundModel.find(filter);

    if (!refunds.length) {
      return res.status(200).json({
        success: false,
        message: "No refund requests found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Refund requests retrieved successfully.",
      data: refunds,
    });
  } catch (error) {
    console.error("Error retrieving refunds:", error);
    return res.status(400).json({
      success: false,
      message: "An error occurred while retrieving refund requests.",
      error: error.message,
    });
  }
};

module.exports = {
  applyForRefund,
  updateRefundStatus,
  getRefundById,
  getAllRefund,
};
