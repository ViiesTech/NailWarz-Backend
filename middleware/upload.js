const multer = require("multer")

const userStorage = multer.diskStorage({
  destination: "./uploads/user",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const userUpload = multer({
  storage: userStorage,
});

const postStorage = multer.diskStorage({
  destination: "./uploads/post",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const postUpload = multer({
  storage: postStorage,
});

const adminStorage = multer.diskStorage({
  destination: "./uploads/admin",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const adminUpload = multer({
  storage: adminStorage,
});


const technicianStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads/technician"); // make sure this folder exists
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const technicianUpload = multer({ storage: technicianStorage });


const serviceStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "./uploads/service"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const serviceUpload = multer({ storage: serviceStorage });



const battleStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads/battle");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const battleUpload = multer({ storage: battleStorage });

const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads/product");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const imageFileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/webp"
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

const productUpload = multer({
  storage: productStorage,
  fileFilter: imageFileFilter,
  limits: {
    files: 5, // max 5 images
  },
});


module.exports = {
  userUpload,
  postUpload,
  technicianUpload,
  adminUpload,
  serviceUpload,
  battleUpload,
  productUpload,
}
