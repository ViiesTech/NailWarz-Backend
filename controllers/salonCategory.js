const adminProfileModel = require("../models/adminProfile");
const categoryModel = require("../models/salonCategory");

const createSalonCategory = async (req, res) => {
  try {
    const {salonId, categoryName } = req.body;

    const existing = await categoryModel.findOne({ salonId:salonId,categoryName: {$regex : `^${categoryName}$`, $options:"i"} });
    if (existing) return res.status(200).json({ success: false, message: "Category already exists with this name" });

    const category = await categoryModel.create({ salonId : salonId,categoryName: categoryName });
    const salon = await adminProfileModel.findByIdAndUpdate(salonId,{$addToSet:{salonCategoryId:category._id}},{new:true});
    res.status(200).json({ success: true, message: "Category created", data: category });
  } catch (error) {
    console.error("Create Category Error:", error);
    res.status(400).json({ success: false, message: "Server Error", error: error.message });
  }
};

const getSalonCategory = async (req, res) => {
  try {
    const { categoryId, salonId } = req.query
    const filter = {};
    if(categoryId) filter._id = categoryId
    if(salonId) filter.salonId = salonId
    const categories = await categoryModel.find(filter).sort({ createdAt: -1 }).populate("salonId","-password");
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    console.error("Get All Categories Error:", error);
    res.status(400).json({ success: false, message: "Server Error", error: error.message });
  }
};

const updateSalonCategory = async (req, res) => {
  try {
    const {categoryId, categoryName } = req.body;
    const category = await categoryModel.findById(categoryId);
    if (!category) return res.status(200).json({ success: false, message: "Category not found" });

    const existing = await categoryModel.findOne({_id:{$ne: categoryId}, salonId:category.salonId,categoryName: {$regex: `^${categoryName}$`, $options:"i" }})
    if(existing) return res.status(200).json({success:false ,message:"Category already exist with this name"})

    const updated = await categoryModel.findByIdAndUpdate(categoryId,{ categoryName: categoryName },{ new: true });

    if (!updated) return res.status(200).json({ success: false, message: "Category not found" });
    
    return res.status(200).json({ success: true, message: "Category Updated Successfully", data: updated });
  } catch (error) {
    console.error("Update Category Error:", error);
    res.status(400).json({ success: false, message: "Server Error", error: error.message });
  }
};

const deleteSalonCategory = async (req, res) => {
  try {
    const { categoryId } = req.body;

    const deleted = await categoryModel.findByIdAndDelete(categoryId);

    if (!deleted) return res.status(200).json({ success: false, message: "Category not found" });
    const salon = await adminProfileModel.findByIdAndUpdate(deleted.salonId,{$pull:{salonCategoryId:categoryId}},{new:true})

    res.status(200).json({ success: true, message: "Category deleted" });
  } catch (error) {
    console.error("Delete Category Error:", error);
    res.status(400).json({ success: false, message: "Server Error", error: error.message });
  }
};

module.exports = {
  createSalonCategory,
  getSalonCategory,
  updateSalonCategory,
  deleteSalonCategory,
};
