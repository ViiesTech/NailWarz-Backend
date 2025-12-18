const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        sku: {
            type: String,
            required: true,
            trim: true
        },
        category: {
            type: [String], // array of strings
            default: [],
            validate: {
                validator: function (value) {
                    return Array.isArray(value) && value.length > 0;
                },
                message: "At least one category is required"
            }
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        status: {
            type: String,
            enum: ["inStock", "lowStock", "outOfStock"],
            default: "inStock"
        },
        isActive: {
            type: Boolean,
            default: true
        },
        stock: { type: Number, default: 0, min: 0 },
        unitType: {
            type: String, required: true, enum: ["piece", "pack"],
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        deletedAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

function setStatus(stock, doc) {
    if (stock <= 0) doc.status = "outOfStock";
    else if (stock <= 10) doc.status = "lowStock";
    else doc.status = "inStock";
}

// SAVE
productSchema.pre("save", function (next) {
    if (this.stock !== undefined) {
        setStatus(this.stock, this);
    }
    next();
});

// FIND & UPDATE
productSchema.pre("findOneAndUpdate", function (next) {
    const update = this.getUpdate();

    if (update.stock !== undefined) {
        setStatus(update.stock, update);
        this.setUpdate(update);
    }
    next();
});

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
