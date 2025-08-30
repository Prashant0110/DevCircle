const mongoose = require("mongoose");
const { Schema } = mongoose;
const validator = require("email-validator");
const JWT = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// User schema
const UserModel = new Schema({
  firstName: {
    type: String,
    required: true,
    minlength: 4,
    maxlength: 25,
    validate: {
      validator: (value) => /^[A-Za-z]+$/.test(value),
      message: "First name should contain only letters",
    },
  },
  lastName: {
    type: String,
    required: true,
    minlength: 4,
    maxlength: 25,
    validate: {
      validator: (value) => /^[A-Za-z]+$/.test(value),
      message: "last name should contain only letters",
    },
  },
  email: {
    type: String,
    required: true,
    unique: true,
    // validate: {
    //   validator: (value) => validator.validate(value),
    //   message: "Invalid email address",
    // },

    validate(value) {
      if (!validator.validate(value)) {
        throw new Error("Invalid email address");
      }
    },
  },
  password: {
    type: String,
    required: true,
  },

  skills: {
    type: [String],
    default: ["Javascript", "Typescript", "React", "NodeJs"],
    validate: {
      validator: (value) => value.length > 2,
      message: "At least 2 skills are required",
    },
  },

  age: {
    type: Number,
    min: 18,
  },

  gender: {
    type: String,
  },
  timeStamps: {
    type: Date,
    default: Date.now(),
  },
});

UserModel.methods.getJWT = async function () {
  const user = this;
  if (!user._id) {
    throw new Error("User not found");
  }

  const token = await JWT.sign({ _id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  return token;
};

UserModel.methods.validatePassword = async function (passwordFromUser) {
  const user = this;
  const hashedPassword = user.password;
  const validatedPassword = await bcrypt.compare(
    passwordFromUser,
    hashedPassword
  );
  return validatedPassword;
};
const User = mongoose.model("User", UserModel);
module.exports = User;
