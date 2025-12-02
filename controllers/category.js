const categoryModel = require("../models/category");

const createCategory = async (req, res) => {
  try {
    const {superAdminId, categoryName } = req.body;

    const existing = await categoryModel.findOne({ categoryName: {$regex : `^${categoryName}$`, $options:"i"} });
    if (existing) return res.status(200).json({ success: false, message: "Category already exists with this name" });

    const category = await categoryModel.create({ superAdminId : superAdminId,categoryName: categoryName });
    res.status(200).json({ success: true, message: "Category created", data: category });
  } catch (error) {
    console.error("Create Category Error:", error);
    res.status(400).json({ success: false, message: "Server Error", error: error.message });
  }
};

const getAllCategories = async (req, res) => {
  try {
    const categories = await categoryModel.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    console.error("Get All Categories Error:", error);
    res.status(400).json({ success: false, message: "Server Error", error: error.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const {categoryId, categoryName } = req.body;

    const existing = await categoryModel.findOne({_id:{$ne: categoryId},categoryName: {$regex: `^${categoryName}$`, $options:"i" }})
    if(existing) return res.status(200).json({success:false ,message:"Category already exist with this name"})

    const updated = await categoryModel.findByIdAndUpdate(categoryId,{ categoryName: categoryName },{ new: true });

    if (!updated) return res.status(200).json({ success: false, message: "Category not found" });
    
    return res.status(200).json({ success: true, message: "Category Updated Successfully", data: updated });
  } catch (error) {
    console.error("Update Category Error:", error);
    res.status(400).json({ success: false, message: "Server Error", error: error.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.body;

    const deleted = await categoryModel.findByIdAndDelete(categoryId);

    if (!deleted) return res.status(200).json({ success: false, message: "Category not found" });
    

    res.status(200).json({ success: true, message: "Category deleted" });
  } catch (error) {
    console.error("Delete Category Error:", error);
    res.status(400).json({ success: false, message: "Server Error", error: error.message });
  }
};

module.exports = {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
};
