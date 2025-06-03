const validator = require("validator");
const validateSignupData = (data) => {
  const { firstName, lastName, email, password } = data;
  if (!firstName || !lastName || !email || !password) {
    throw new Error("All fields are required");
  }

  if (!validator.isEmail(email)) {
    throw new Error("Invalid email format");
  }

  if (!validator.isStrongPassword(password)) {
    throw new Error("please re enter strong password");
  }

  //   if (!Array.isArray(skills) || skills.length < 2) {
  //     throw new Error("At least 2 skills are required");
  //   }
  // };
};
module.exports = {
  validateSignupData,
};
