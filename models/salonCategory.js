const mongoose = require("mongoose");

const categorySchema =new  mongoose.Schema({
  salonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "adminProfile",
    required: true,
  },
  categoryName: {
    type: String,
    required: true,
  },
},
{
  timestamps: true,
});

const categoryModel = mongoose.model("SalonCategory", categorySchema);

module.exports = categoryModel;
