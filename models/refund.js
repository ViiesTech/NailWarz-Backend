const mongoose = require("mongoose")

const refundSchema = new mongoose.Schema({
  userId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"User",
    required:true
  },
  appointmentId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"appointments",
    required:true
  },
  salonId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"adminProfile",
    required:true
  },
  paymentId:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Payment",
    required:true
  },
  reason:{
    type:String,
  },
  status:{
    type:String,
    enum:["Pending","Rejected","Approved"],
    default:"Pending"
  }
},{timestamps:true})

const  refundModel = mongoose.model("Refund",refundSchema)

module.exports =refundModel